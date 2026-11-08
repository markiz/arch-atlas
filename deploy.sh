#!/usr/bin/env bash
set -Eeuo pipefail

remote="${PAGES_REMOTE:-origin}"
branch="${PAGES_BRANCH:-gh-pages}"

fail() { printf 'Ошибка: %s\n' "$*" >&2; exit 1; }

for cmd in git node npm mktemp tar; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Не найдена команда $cmd"
done

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  fail 'Запусти скрипт внутри Git-репозитория.'

cd "$repo_root"

[[ -f package.json && -f package-lock.json ]] ||
  fail 'В корне репозитория нужны package.json и package-lock.json проекта.'

git remote get-url -- "$remote" >/dev/null 2>&1 ||
  fail "Git remote '$remote' не настроен."

git check-ref-format --branch "$branch" >/dev/null 2>&1 ||
  fail "Некорректное имя ветки: $branch"

current_branch="$(git symbolic-ref --quiet --short HEAD || true)"

[[ "$branch" != "$current_branch" ]] ||
  fail 'Ветка публикации совпадает с текущей веткой. Выбери отдельную ветку.'

[[ "$branch" != main && "$branch" != master ]] ||
  fail 'Ветки main и master защищены от замены. Выбери отдельную ветку Pages.'

git var GIT_AUTHOR_IDENT >/dev/null 2>&1 ||
  fail 'Настрой git user.name и user.email перед публикацией.'

printf 'Проверяю ветку %s на %s...\n' "$branch" "$remote"

remote_refs="$(git ls-remote --heads -- "$remote" "refs/heads/$branch")" ||
  fail 'Не удалось обратиться к remote. Проверь доступ и авторизацию.'

parent=''
if [[ -n "$remote_refs" ]]; then
  git fetch --no-tags -- "$remote" "refs/heads/$branch"
  parent="$(git rev-parse --verify 'FETCH_HEAD^{commit}')"
fi

# Копия включает незакоммиченные изменения и удаляется после запуска.
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/atlas-pages.XXXXXXXX")"
tmp_dir="$(cd "$tmp_dir" && pwd -P)"
repo_root="$(cd "$repo_root" && pwd -P)"

trap 'rm -rf -- "$tmp_dir"' EXIT

case "$tmp_dir/" in
  "$repo_root/"*)
    fail 'Временная папка внутри репозитория. Задай TMPDIR вне репозитория.'
    ;;
esac

mkdir -p "$tmp_dir/project"

tar -C "$repo_root" \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./.deps' \
  --exclude='./work' \
  --exclude='./.tmp' \
  -cf - . | tar -C "$tmp_dir/project" -xf -

if [[ -d "$repo_root/node_modules" ]] && npm ls --depth=0 >/dev/null 2>&1; then
  ln -s "$repo_root/node_modules" "$tmp_dir/project/node_modules"
else
  printf 'Устанавливаю зависимости из package-lock.json...\n'
  (cd "$tmp_dir/project" && npm ci)
fi

printf 'Собираю сайт...\n'
(cd "$tmp_dir/project" && npm run build)

[[ -f "$tmp_dir/project/dist/index.html" ]] ||
  fail 'После сборки не найден dist/index.html.'

# Превью и статистика рейтингов — дорогие производные данные. Обе папки
# gitignored, но возвращаем их в рабочий репозиторий: следующая сборка во
# временной копии иначе снова начнёт с холодной генерации.
if [[ -d "$tmp_dir/project/.cache" ]]; then
  mkdir -p "$repo_root/.cache"
  cp -a --update "$tmp_dir/project/.cache/." "$repo_root/.cache/" ||
    printf 'Предупреждение: не удалось сохранить .cache, следующая сборка будет холоднее.\n' >&2
fi
if [[ -d "$tmp_dir/project/data/thumbnails" ]]; then
  mkdir -p "$repo_root/data/thumbnails"
  cp -a --update "$tmp_dir/project/data/thumbnails/." "$repo_root/data/thumbnails/" ||
    printf 'Предупреждение: не удалось сохранить data/thumbnails, следующая сборка будет холоднее.\n' >&2
fi

mkdir -p "$tmp_dir/site"
cp -R "$tmp_dir/project/dist/." "$tmp_dir/site/"
: > "$tmp_dir/site/.nojekyll"

git_dir="$(git rev-parse --absolute-git-dir)"
export GIT_INDEX_FILE="$tmp_dir/index"

# Дерево ветки собирается заново из текущей сборки: устаревшие ассеты
# (старые бандлы, удалённые фотографии) должны исчезать из ветки, иначе она
# растёт без ограничений. Из прошлого дерева переносится только CNAME.
rm -f "$GIT_INDEX_FILE"
git --git-dir="$git_dir" read-tree --empty

if [[ -n "$parent" ]] && git --git-dir="$git_dir" cat-file -e "$parent:CNAME" 2>/dev/null; then
  git --git-dir="$git_dir" show "$parent:CNAME" > "$tmp_dir/site/CNAME"
fi

(
  cd "$tmp_dir/site"
  git --git-dir="$git_dir" --work-tree="$tmp_dir/site" \
    add --force -- .
)

tree="$(git --git-dir="$git_dir" write-tree)"

if [[ -n "$parent" ]] && [[ "$tree" == "$(git rev-parse "$parent^{tree}")" ]]; then
  printf 'Сайт не изменился: ветка %s уже содержит эту сборку.\n' "$branch"
  exit 0
fi

if [[ -n "$parent" ]]; then
  commit="$(printf 'Deploy atlas\n' |
    git --git-dir="$git_dir" commit-tree "$tree" -p "$parent")"
else
  commit="$(printf 'Deploy atlas\n' |
    git --git-dir="$git_dir" commit-tree "$tree")"
fi

printf 'Отправляю сборку в %s/%s...\n' "$remote" "$branch"
git push -- "$remote" "$commit:refs/heads/$branch"

printf '\nГотово. В GitHub: Settings → Pages → '
printf 'Deploy from a branch → %s / (root).\n' "$branch"
