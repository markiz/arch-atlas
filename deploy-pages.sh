#!/usr/bin/env bash
set -Eeuo pipefail

# Run from anywhere inside the project repository.
# Override with: PAGES_REMOTE=origin PAGES_BRANCH=gh-pages bash deploy-pages.sh
# Set PAGES_PUSH=no to write a local branch commit without contacting a remote.
remote="${PAGES_REMOTE:-origin}"
branch="${PAGES_BRANCH:-gh-pages}"
push_mode="${PAGES_PUSH:-yes}"

fail() { printf 'Ошибка: %s\n' "$*" >&2; exit 1; }
for cmd in git node npm mktemp tar; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Не найдена команда $cmd"
done

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || fail 'Запусти скрипт внутри Git-репозитория.'
cd "$repo_root"
[[ -f package.json && -f package-lock.json ]] || fail 'В корне репозитория нужны package.json и package-lock.json проекта.'
[[ -f index.html ]] || fail 'В корне проекта не найден index.html. Нужен полный исходный проект Vite, а не только Docker-файлы.'
git check-ref-format --branch "$branch" >/dev/null 2>&1 || fail "Некорректное имя ветки: $branch"
current_branch="$(git symbolic-ref --quiet --short HEAD || true)"
[[ "$branch" != "$current_branch" ]] || fail 'Ветка публикации совпадает с текущей веткой. Выбери отдельную ветку.'
[[ "$branch" != main && "$branch" != master ]] || fail 'Ветки main и master защищены от замены. Выбери отдельную ветку Pages.'
git var GIT_AUTHOR_IDENT >/dev/null 2>&1 || fail 'Настрой git user.name и user.email перед публикацией.'

parent=''
branch_ref="refs/heads/$branch"
if [[ "$push_mode" == yes ]]; then
  git remote get-url -- "$remote" >/dev/null 2>&1 || fail "Git remote '$remote' не настроен."
  printf 'Проверяю ветку %s на %s...\n' "$branch" "$remote"
  remote_refs="$(git ls-remote --heads -- "$remote" "$branch_ref")" || fail 'Не удалось обратиться к remote. Проверь доступ и авторизацию.'
  if [[ -n "$remote_refs" ]]; then
    git fetch --no-tags -- "$remote" "$branch_ref"
    parent="$(git rev-parse --verify 'FETCH_HEAD^{commit}')"
  fi
elif [[ "$push_mode" == no ]]; then
  printf 'Готовлю локальный коммит в ветке %s...\n' "$branch"
  if git show-ref --verify --quiet "$branch_ref"; then
    parent="$(git rev-parse --verify "$branch_ref^{commit}")"
  fi
else
  fail 'PAGES_PUSH должен быть yes или no.'
fi

# The temporary directory is private and deliberately kept for inspection.
# It contains a copy of the current files, including uncommitted changes.
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/atlas-pages.XXXXXXXX")"
tmp_dir="$(cd "$tmp_dir" && pwd -P)"
repo_root="$(cd "$repo_root" && pwd -P)"
trap 'printf "\nВременная копия сохранена: %s\n" "$tmp_dir"' EXIT
case "$tmp_dir/" in
  "$repo_root/"*) fail 'Временная папка оказалась внутри репозитория. Задай TMPDIR вне репозитория.' ;;
esac
mkdir -p "$tmp_dir/project"
tar -C "$repo_root" \
  --exclude='./.git' --exclude='./node_modules' \
  --exclude='./dist' --exclude='./.deps' \
  -cf - . | tar -C "$tmp_dir/project" -xf -
if [[ -n "${ATLAS_NODE_MODULES:-}" ]]; then
  [[ -d "$ATLAS_NODE_MODULES" ]] || fail 'ATLAS_NODE_MODULES указывает на отсутствующую папку.'
  if [[ -n "${ATLAS_LOCKFILE:-}" ]]; then
    command -v cmp >/dev/null 2>&1 || fail 'Не найдена команда cmp.'
    cmp -s "$repo_root/package-lock.json" "$ATLAS_LOCKFILE" ||
      fail 'package-lock.json изменился. Пересобери Docker-образ.'
  fi
  cp -R "$ATLAS_NODE_MODULES" "$tmp_dir/project/node_modules"
  (cd "$tmp_dir/project" && npm ls --depth=0 >/dev/null 2>&1) ||
    fail 'Зависимости не соответствуют package.json. Пересобери Docker-образ.'
elif [[ -d "$repo_root/node_modules" ]] && npm ls --depth=0 >/dev/null 2>&1; then
  ln -s "$repo_root/node_modules" "$tmp_dir/project/node_modules"
else
  printf 'Устанавливаю зависимости из package-lock.json...\n'
  (cd "$tmp_dir/project" && npm ci)
fi
printf 'Собираю сайт...\n'
(cd "$tmp_dir/project" && npm run build)
[[ -f "$tmp_dir/project/dist/index.html" ]] || fail 'После сборки не найден dist/index.html.'

# A private temporary index creates the deployment commit without switching
# branches or modifying the user's index and working tree.
mkdir -p "$tmp_dir/site"
cp -R "$tmp_dir/project/dist/." "$tmp_dir/site/"
: > "$tmp_dir/site/.nojekyll"
git_dir="$(git rev-parse --absolute-git-dir)"
export GIT_INDEX_FILE="$tmp_dir/index"
# Build the tree from scratch so the branch mirrors the current build exactly:
# assets that disappeared from the build (old bundles, removed photos) must
# disappear from the branch too, otherwise every deploy keeps them forever and
# the branch grows without bound. Only CNAME is carried over from the previous
# tree.
rm -f "$GIT_INDEX_FILE"
git --git-dir="$git_dir" read-tree --empty
if [[ -n "$parent" ]] && git --git-dir="$git_dir" cat-file -e "$parent:CNAME" 2>/dev/null; then
  git --git-dir="$git_dir" show "$parent:CNAME" > "$tmp_dir/site/CNAME"
fi
(
  cd "$tmp_dir/site"
  git --git-dir="$git_dir" --work-tree="$tmp_dir/site" add --force -- .
)
tree="$(git --git-dir="$git_dir" write-tree)"
if [[ -n "$parent" ]] && [[ "$tree" == "$(git rev-parse "$parent^{tree}")" ]]; then
  printf 'Сайт не изменился: ветка %s уже содержит эту сборку.\n' "$branch"
  exit 0
fi

if [[ -n "$parent" ]]; then
  commit="$(printf 'Deploy atlas\n' | git --git-dir="$git_dir" commit-tree "$tree" -p "$parent")"
else
  commit="$(printf 'Deploy atlas\n' | git --git-dir="$git_dir" commit-tree "$tree")"
fi
if [[ "$push_mode" == no ]]; then
  old_ref="$(git rev-parse --verify "$branch_ref" 2>/dev/null || true)"
  if [[ -n "$parent" && "$old_ref" != "$parent" ]]; then
    fail "Локальная ветка $branch изменилась во время сборки; коммит создан ($commit), но указатель ветки не менялся."
  fi
  if [[ -n "$parent" ]]; then
    git update-ref "$branch_ref" "$commit" "$parent"
  else
    git update-ref "$branch_ref" "$commit" ''
  fi
  printf '\nЛокальный коммит готов: %s (%s).\n' "$branch" "$commit"
  printf 'На хосте отправь его командой: git push %s %s\n' "$remote" "$branch"
else
  printf 'Отправляю сборку в %s/%s...\n' "$remote" "$branch"
  git push -- "$remote" "$commit:$branch_ref"
  printf '\nГотово. В GitHub: Settings → Pages → Deploy from a branch → %s / (root).\n' "$branch"
  printf 'GitHub Pages может потребовать некоторое время для публикации.\n'
fi
