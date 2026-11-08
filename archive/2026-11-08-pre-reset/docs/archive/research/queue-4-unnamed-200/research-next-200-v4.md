# Исследовательская очередь: следующие 200 объектов Тбилиси (четвёртая очередь)

**Статус:** разобраны все 200: 96 READY, 97 HOLD, 7 REJECT; 96 карточек интегрировано; очередь закрыта. Итоги — в [research-queue-v4-progress.md](research-queue-v4-progress.md).

Предыдущая очередь: [research-next-200-v3.md](../queue-3-heritage-200/research-next-200-v3.md), её итоги — в [research-queue-v3.md](../queue-3-heritage-200/research-queue-v3.md). После трёх очередей именованных объектов в реестре не осталось: очередь состоит из 200 лучших безымянных исторических жилых домов.

**Снимок:** 2026-10-31 UTC. Контуры: © участники OpenStreetMap, [ODbL](https://www.openstreetmap.org/copyright).

## Основание и метод

- В официальном реестре найдено записей по Тбилиси: **2599**. Запрос: `Region=N'თბილისი'` к [слою недвижимых памятников](https://memkvidreoba.gov.ge/arcgisch/rest/services/CultureWMS/PS_ImmovableMonumentObjectP/MapServer/1).
- Сопоставление выполнено с 121,313 контурами из локальной OSM-выгрузки `raw/osm-tbilisi-building-outlines.geojson` и 267 карточками атласа на момент отбора.
- Отобраны записи с классификацией архитектуры, отдельным контуром OSM в радиусе примерно 17 м, без близкого совпадения или значительного пересечения с текущей карточкой атласа. Сначала взяты записи с конкретным названием и содержательным описанием.
- Исключены все записи предыдущих очередей: `docs/research-next-200.md`, `docs/research-next-200-v2.md`, `docs/research-next-200-v3.md`. Это не даёт повторно отобрать уже разобранных кандидатов.
- Сопоставление точки реестра с контуром автоматическое. Даже расстояние 0 м не подтверждает, что реестр и контур относятся к одному корпусу; каждую пару нужно проверить на карте и по адресу.
- Официальные текстовые поля не перепечатываются в этом отчёте: условия повторного использования данных реестра не установлены. Идентификаторы нужны для открытия карточек источника.

## Сводка пробелов для отобранных 200

| Поле / проверка | Не хватает или нужно проверить | Что известно сейчас |
|---|---:|---|
| Адрес в реестре | 0/200 без адреса | Наличие поля не заменяет проверку адреса и перевод на русский, английский и украинский |
| Датировка в реестре | 0/200 без `ExactDate`; 176/200 без четырёхзначного года в строке | Год в строке также требует проверки: он может относиться к перестройке или диапазону |
| Описание в реестре | 0/200 без описания | Тексты источника на грузинском требуют редакционной выжимки и перевода |
| Номер реестра | 13/200 без `RegistryN` | `ObjectID` и ссылка на источник остаются доступны |
| Архитектор | 194/200 без тега архитектора в сопоставленном OSM-контуре | Отдельного поля архитектора в схеме реестра нет; нужна профильная проверка |
| Стиль | 200/200 без `building:architecture` в OSM | У реестра нет отдельного поля стиля; классифицировать по источнику/фасаду |
| Фото | 198/200 без тега `wikimedia_commons` у контура | Проверенной локальной галереи с автором, лицензией и правами пока нет |
| Геометрия | 0/200 без близкого контура OSM; 6/200 точек реестра дальше 5 м от сопоставленного контура | Все пары требуют ручного подтверждения принадлежности корпуса и качества Polygon |
| Переводы и карточка атласа | 200/200 | Нужны переводы имени, адреса и описания на ru/en/ka/uk, район, стиль/авторы с ID и редакционный текст |

## Список для ручной проверки

Таблица не содержит названий и адресов из реестра. Откройте карточку источника по ссылке; OSM way — только пространственный кандидат.

| № | ID реестра | Реестр | OSM way-кандидат | Адрес в источнике | Дата в источнике | Архитектор в OSM | Стиль в OSM | Commons-ссылка | Смещение точки, м |
|---:|---:|---|---|---|---|---|---|---|---:|
| 1 | 3196 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3196) | [way/1279183709](https://www.openstreetmap.org/way/1279183709) | есть | есть | нет | нет | нет | 0.0 |
| 2 | 3199 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3199) | [way/561606904](https://www.openstreetmap.org/way/561606904) | есть | есть | нет | нет | нет | 0.0 |
| 3 | 3200 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3200) | [way/336997944](https://www.openstreetmap.org/way/336997944) | есть | есть | нет | нет | нет | 0.0 |
| 4 | 3201 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3201) | [way/1131162691](https://www.openstreetmap.org/way/1131162691) | есть | есть | нет | нет | нет | 0.0 |
| 5 | 3205 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3205) | [way/416305166](https://www.openstreetmap.org/way/416305166) | есть | есть | нет | нет | нет | 0.0 |
| 6 | 3206 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3206) | [way/415940828](https://www.openstreetmap.org/way/415940828) | есть | есть | нет | нет | нет | 0.0 |
| 7 | 3209 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3209) | [way/282713321](https://www.openstreetmap.org/way/282713321) | есть | есть | нет | нет | нет | 0.0 |
| 8 | 3211 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3211) | [way/416302078](https://www.openstreetmap.org/way/416302078) | есть | есть | нет | нет | нет | 0.0 |
| 9 | 3212 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3212) | [way/416307059](https://www.openstreetmap.org/way/416307059) | есть | есть | нет | нет | нет | 0.0 |
| 10 | 3213 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3213) | [way/462898535](https://www.openstreetmap.org/way/462898535) | есть | есть | нет | нет | нет | 0.0 |
| 11 | 3218 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3218) | [way/463651688](https://www.openstreetmap.org/way/463651688) | есть | есть | нет | нет | нет | 1.4 |
| 12 | 3222 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3222) | [way/1131162704](https://www.openstreetmap.org/way/1131162704) | есть | есть | нет | нет | нет | 0.0 |
| 13 | 3223 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3223) | [way/414653509](https://www.openstreetmap.org/way/414653509) | есть | есть | нет | нет | нет | 0.0 |
| 14 | 3224 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3224) | [way/416305164](https://www.openstreetmap.org/way/416305164) | есть | есть | нет | нет | нет | 0.0 |
| 15 | 3225 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3225) | [way/416302082](https://www.openstreetmap.org/way/416302082) | есть | есть | нет | нет | нет | 0.0 |
| 16 | 3228 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3228) | [way/416302086](https://www.openstreetmap.org/way/416302086) | есть | есть | есть | нет | нет | 0.0 |
| 17 | 3230 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3230) | [way/1222201512](https://www.openstreetmap.org/way/1222201512) | есть | есть | нет | нет | нет | 0.0 |
| 18 | 3232 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3232) | [way/1365779885](https://www.openstreetmap.org/way/1365779885) | есть | есть | нет | нет | нет | 0.0 |
| 19 | 3233 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3233) | [way/417139654](https://www.openstreetmap.org/way/417139654) | есть | есть | нет | нет | нет | 0.0 |
| 20 | 3234 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3234) | [way/417691874](https://www.openstreetmap.org/way/417691874) | есть | есть | нет | нет | нет | 0.0 |
| 21 | 3237 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3237) | [way/417136686](https://www.openstreetmap.org/way/417136686) | есть | есть | нет | нет | нет | 0.0 |
| 22 | 3238 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3238) | [way/1221980514](https://www.openstreetmap.org/way/1221980514) | есть | есть | нет | нет | нет | 0.0 |
| 23 | 3241 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3241) | [way/417136700](https://www.openstreetmap.org/way/417136700) | есть | есть | нет | нет | нет | 0.0 |
| 24 | 3242 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3242) | [way/1013496104](https://www.openstreetmap.org/way/1013496104) | есть | есть | нет | нет | нет | 0.9 |
| 25 | 3249 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3249) | [way/416304836](https://www.openstreetmap.org/way/416304836) | есть | есть | нет | нет | нет | 0.0 |
| 26 | 3254 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3254) | [way/1069053621](https://www.openstreetmap.org/way/1069053621) | есть | есть | нет | нет | нет | 0.0 |
| 27 | 3258 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3258) | [way/462897301](https://www.openstreetmap.org/way/462897301) | есть | есть | нет | нет | нет | 0.0 |
| 28 | 3259 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3259) | [way/427377257](https://www.openstreetmap.org/way/427377257) | есть | есть | нет | нет | нет | 0.0 |
| 29 | 3260 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3260) | [way/1372056216](https://www.openstreetmap.org/way/1372056216) | есть | есть | нет | нет | нет | 0.0 |
| 30 | 3261 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3261) | [way/1218781707](https://www.openstreetmap.org/way/1218781707) | есть | есть | нет | нет | нет | 0.0 |
| 31 | 3264 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3264) | [way/282713344](https://www.openstreetmap.org/way/282713344) | есть | есть | нет | нет | нет | 0.0 |
| 32 | 3273 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3273) | [way/1217883909](https://www.openstreetmap.org/way/1217883909) | есть | есть | нет | нет | нет | 3.1 |
| 33 | 3275 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3275) | [way/416306408](https://www.openstreetmap.org/way/416306408) | есть | есть | нет | нет | нет | 0.0 |
| 34 | 3276 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3276) | [way/246754369](https://www.openstreetmap.org/way/246754369) | есть | есть | нет | нет | нет | 0.0 |
| 35 | 3280 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3280) | [way/282713346](https://www.openstreetmap.org/way/282713346) | есть | есть | нет | нет | нет | 0.0 |
| 36 | 3281 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3281) | [way/282713348](https://www.openstreetmap.org/way/282713348) | есть | есть | нет | нет | нет | 0.0 |
| 37 | 3283 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3283) | [way/1127960803](https://www.openstreetmap.org/way/1127960803) | есть | есть | нет | нет | нет | 0.0 |
| 38 | 3285 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3285) | [way/79689649](https://www.openstreetmap.org/way/79689649) | есть | есть | нет | нет | нет | 0.0 |
| 39 | 3286 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3286) | [way/414656208](https://www.openstreetmap.org/way/414656208) | есть | есть | есть | нет | нет | 0.0 |
| 40 | 3288 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3288) | [way/282471273](https://www.openstreetmap.org/way/282471273) | есть | есть | нет | нет | есть | 0.0 |
| 41 | 3291 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3291) | [way/417136696](https://www.openstreetmap.org/way/417136696) | есть | есть | нет | нет | нет | 0.0 |
| 42 | 3294 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3294) | [way/414656209](https://www.openstreetmap.org/way/414656209) | есть | есть | есть | нет | нет | 0.0 |
| 43 | 3296 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3296) | [way/1222201504](https://www.openstreetmap.org/way/1222201504) | есть | есть | нет | нет | нет | 0.0 |
| 44 | 3297 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3297) | [way/416302085](https://www.openstreetmap.org/way/416302085) | есть | есть | нет | нет | нет | 0.0 |
| 45 | 3298 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3298) | [way/414655001](https://www.openstreetmap.org/way/414655001) | есть | есть | есть | нет | нет | 0.0 |
| 46 | 3301 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3301) | [way/1131162707](https://www.openstreetmap.org/way/1131162707) | есть | есть | нет | нет | нет | 0.0 |
| 47 | 3306 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3306) | [way/416319643](https://www.openstreetmap.org/way/416319643) | есть | есть | нет | нет | нет | 0.0 |
| 48 | 3308 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3308) | [way/417136667](https://www.openstreetmap.org/way/417136667) | есть | есть | нет | нет | нет | 0.0 |
| 49 | 3311 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3311) | [way/414653508](https://www.openstreetmap.org/way/414653508) | есть | есть | нет | нет | нет | 0.0 |
| 50 | 3314 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3314) | [way/1222201586](https://www.openstreetmap.org/way/1222201586) | есть | есть | нет | нет | нет | 0.0 |
| 51 | 3316 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3316) | [way/282467821](https://www.openstreetmap.org/way/282467821) | есть | есть | нет | нет | нет | 0.0 |
| 52 | 3318 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3318) | [way/462897304](https://www.openstreetmap.org/way/462897304) | есть | есть | нет | нет | нет | 0.0 |
| 53 | 3320 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3320) | [way/463651696](https://www.openstreetmap.org/way/463651696) | есть | есть | есть | нет | есть | 0.0 |
| 54 | 3322 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3322) | [way/1315650627](https://www.openstreetmap.org/way/1315650627) | есть | есть | нет | нет | нет | 0.0 |
| 55 | 3324 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3324) | [way/1136648243](https://www.openstreetmap.org/way/1136648243) | есть | есть | нет | нет | нет | 0.0 |
| 56 | 3327 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3327) | [way/1350810934](https://www.openstreetmap.org/way/1350810934) | есть | есть | нет | нет | нет | 0.2 |
| 57 | 3330 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3330) | [way/1219556125](https://www.openstreetmap.org/way/1219556125) | есть | есть | нет | нет | нет | 0.0 |
| 58 | 3335 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3335) | [way/1222201537](https://www.openstreetmap.org/way/1222201537) | есть | есть | нет | нет | нет | 0.0 |
| 59 | 3337 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3337) | [way/1221619308](https://www.openstreetmap.org/way/1221619308) | есть | есть | нет | нет | нет | 0.0 |
| 60 | 3338 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3338) | [way/1222201591](https://www.openstreetmap.org/way/1222201591) | есть | есть | нет | нет | нет | 0.0 |
| 61 | 3340 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3340) | [way/1069679656](https://www.openstreetmap.org/way/1069679656) | есть | есть | нет | нет | нет | 0.0 |
| 62 | 3341 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3341) | [way/78331828](https://www.openstreetmap.org/way/78331828) | есть | есть | нет | нет | нет | 0.0 |
| 63 | 3345 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3345) | [way/1078430925](https://www.openstreetmap.org/way/1078430925) | есть | есть | нет | нет | нет | 0.0 |
| 64 | 3349 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3349) | [way/1219556067](https://www.openstreetmap.org/way/1219556067) | есть | есть | нет | нет | нет | 0.0 |
| 65 | 3356 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3356) | [way/1157078690](https://www.openstreetmap.org/way/1157078690) | есть | есть | нет | нет | нет | 0.0 |
| 66 | 3357 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3357) | [way/1222201594](https://www.openstreetmap.org/way/1222201594) | есть | есть | нет | нет | нет | 0.0 |
| 67 | 3359 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3359) | [way/1207173721](https://www.openstreetmap.org/way/1207173721) | есть | есть | нет | нет | нет | 0.0 |
| 68 | 3370 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3370) | [way/1217883854](https://www.openstreetmap.org/way/1217883854) | есть | есть | нет | нет | нет | 0.0 |
| 69 | 3373 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3373) | [way/1219556137](https://www.openstreetmap.org/way/1219556137) | есть | есть | нет | нет | нет | 0.0 |
| 70 | 3378 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3378) | [way/1222201481](https://www.openstreetmap.org/way/1222201481) | есть | есть | нет | нет | нет | 0.0 |
| 71 | 3379 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3379) | [way/1222201592](https://www.openstreetmap.org/way/1222201592) | есть | есть | нет | нет | нет | 0.0 |
| 72 | 3381 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3381) | [way/1206891436](https://www.openstreetmap.org/way/1206891436) | есть | есть | нет | нет | нет | 0.0 |
| 73 | 3382 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3382) | [way/79704622](https://www.openstreetmap.org/way/79704622) | есть | есть | нет | нет | нет | 0.9 |
| 74 | 3384 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3384) | [way/1222201612](https://www.openstreetmap.org/way/1222201612) | есть | есть | нет | нет | нет | 0.0 |
| 75 | 3390 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3390) | [way/1217883872](https://www.openstreetmap.org/way/1217883872) | есть | есть | нет | нет | нет | 0.0 |
| 76 | 3395 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3395) | [way/1218781711](https://www.openstreetmap.org/way/1218781711) | есть | есть | нет | нет | нет | 0.0 |
| 77 | 3398 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3398) | [way/1217883849](https://www.openstreetmap.org/way/1217883849) | есть | есть | нет | нет | нет | 0.0 |
| 78 | 3401 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3401) | [way/1221980528](https://www.openstreetmap.org/way/1221980528) | есть | есть | нет | нет | нет | 0.0 |
| 79 | 3402 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3402) | [way/337430167](https://www.openstreetmap.org/way/337430167) | есть | есть | нет | нет | нет | 0.0 |
| 80 | 3404 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3404) | [way/1129861626](https://www.openstreetmap.org/way/1129861626) | есть | есть | нет | нет | нет | 0.0 |
| 81 | 3405 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3405) | [way/1078430926](https://www.openstreetmap.org/way/1078430926) | есть | есть | нет | нет | нет | 0.0 |
| 82 | 3406 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3406) | [way/1351028516](https://www.openstreetmap.org/way/1351028516) | есть | есть | нет | нет | нет | 7.8 |
| 83 | 3412 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3412) | [way/1217883890](https://www.openstreetmap.org/way/1217883890) | есть | есть | нет | нет | нет | 0.0 |
| 84 | 3418 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3418) | [way/352650208](https://www.openstreetmap.org/way/352650208) | есть | есть | нет | нет | нет | 0.0 |
| 85 | 3421 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3421) | [way/1222201547](https://www.openstreetmap.org/way/1222201547) | есть | есть | нет | нет | нет | 3.4 |
| 86 | 3422 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3422) | [way/1218129723](https://www.openstreetmap.org/way/1218129723) | есть | есть | нет | нет | нет | 0.0 |
| 87 | 3425 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3425) | [way/506741617](https://www.openstreetmap.org/way/506741617) | есть | есть | нет | нет | нет | 0.0 |
| 88 | 3426 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3426) | [way/1207570046](https://www.openstreetmap.org/way/1207570046) | есть | есть | нет | нет | нет | 0.0 |
| 89 | 3427 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3427) | [way/1351037212](https://www.openstreetmap.org/way/1351037212) | есть | есть | нет | нет | нет | 0.0 |
| 90 | 3428 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3428) | [way/337428920](https://www.openstreetmap.org/way/337428920) | есть | есть | нет | нет | нет | 0.0 |
| 91 | 3437 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3437) | [way/1359705793](https://www.openstreetmap.org/way/1359705793) | есть | есть | нет | нет | нет | 7.3 |
| 92 | 3438 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3438) | [way/345185758](https://www.openstreetmap.org/way/345185758) | есть | есть | нет | нет | нет | 16.2 |
| 93 | 3442 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3442) | [way/1126037601](https://www.openstreetmap.org/way/1126037601) | есть | есть | нет | нет | нет | 0.0 |
| 94 | 3444 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3444) | [way/1221959556](https://www.openstreetmap.org/way/1221959556) | есть | есть | нет | нет | нет | 0.0 |
| 95 | 3454 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3454) | [way/1127985193](https://www.openstreetmap.org/way/1127985193) | есть | есть | нет | нет | нет | 0.0 |
| 96 | 3458 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3458) | [way/1126037584](https://www.openstreetmap.org/way/1126037584) | есть | есть | нет | нет | нет | 0.0 |
| 97 | 3459 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3459) | [way/1218781736](https://www.openstreetmap.org/way/1218781736) | есть | есть | нет | нет | нет | 0.0 |
| 98 | 3464 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3464) | [way/1155841786](https://www.openstreetmap.org/way/1155841786) | есть | есть | нет | нет | нет | 0.0 |
| 99 | 3465 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3465) | [way/1207148777](https://www.openstreetmap.org/way/1207148777) | есть | есть | нет | нет | нет | 0.0 |
| 100 | 3470 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3470) | [way/1126037623](https://www.openstreetmap.org/way/1126037623) | есть | есть | нет | нет | нет | 0.0 |
| 101 | 3471 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3471) | [way/1206891459](https://www.openstreetmap.org/way/1206891459) | есть | есть | нет | нет | нет | 0.0 |
| 102 | 3472 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3472) | [way/282242699](https://www.openstreetmap.org/way/282242699) | есть | есть | нет | нет | нет | 0.0 |
| 103 | 3477 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3477) | [way/1155911044](https://www.openstreetmap.org/way/1155911044) | есть | есть | нет | нет | нет | 0.4 |
| 104 | 3478 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3478) | [way/1350810940](https://www.openstreetmap.org/way/1350810940) | есть | есть | нет | нет | нет | 0.0 |
| 105 | 3479 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3479) | [way/1206434206](https://www.openstreetmap.org/way/1206434206) | есть | есть | нет | нет | нет | 0.0 |
| 106 | 3482 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3482) | [way/771223197](https://www.openstreetmap.org/way/771223197) | есть | есть | нет | нет | нет | 0.0 |
| 107 | 3483 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3483) | [way/1126037579](https://www.openstreetmap.org/way/1126037579) | есть | есть | нет | нет | нет | 0.0 |
| 108 | 3487 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3487) | [way/1126037620](https://www.openstreetmap.org/way/1126037620) | есть | есть | нет | нет | нет | 0.0 |
| 109 | 3488 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3488) | [way/1126037619](https://www.openstreetmap.org/way/1126037619) | есть | есть | нет | нет | нет | 0.0 |
| 110 | 3491 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3491) | [way/345185756](https://www.openstreetmap.org/way/345185756) | есть | есть | нет | нет | нет | 0.0 |
| 111 | 3493 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3493) | [way/1206891411](https://www.openstreetmap.org/way/1206891411) | есть | есть | нет | нет | нет | 0.0 |
| 112 | 3496 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3496) | [way/1075605527](https://www.openstreetmap.org/way/1075605527) | есть | есть | нет | нет | нет | 0.0 |
| 113 | 3502 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3502) | [way/1206705379](https://www.openstreetmap.org/way/1206705379) | есть | есть | нет | нет | нет | 0.0 |
| 114 | 3503 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3503) | [way/1126037599](https://www.openstreetmap.org/way/1126037599) | есть | есть | нет | нет | нет | 0.0 |
| 115 | 3507 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3507) | [way/1219973467](https://www.openstreetmap.org/way/1219973467) | есть | есть | нет | нет | нет | 0.0 |
| 116 | 3509 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3509) | [way/1207570038](https://www.openstreetmap.org/way/1207570038) | есть | есть | нет | нет | нет | 0.0 |
| 117 | 3513 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3513) | [way/539771943](https://www.openstreetmap.org/way/539771943) | есть | есть | нет | нет | нет | 0.0 |
| 118 | 3516 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3516) | [way/433282569](https://www.openstreetmap.org/way/433282569) | есть | есть | нет | нет | нет | 0.0 |
| 119 | 3520 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3520) | [way/1207148749](https://www.openstreetmap.org/way/1207148749) | есть | есть | нет | нет | нет | 0.0 |
| 120 | 3521 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3521) | [way/506741620](https://www.openstreetmap.org/way/506741620) | есть | есть | нет | нет | нет | 0.0 |
| 121 | 3522 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3522) | [way/506741610](https://www.openstreetmap.org/way/506741610) | есть | есть | нет | нет | нет | 0.0 |
| 122 | 3523 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3523) | [way/1464393310](https://www.openstreetmap.org/way/1464393310) | есть | есть | нет | нет | нет | 0.0 |
| 123 | 3525 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3525) | [way/1126037622](https://www.openstreetmap.org/way/1126037622) | есть | есть | нет | нет | нет | 0.0 |
| 124 | 3531 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3531) | [way/771660817](https://www.openstreetmap.org/way/771660817) | есть | есть | нет | нет | нет | 0.0 |
| 125 | 3535 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3535) | [way/1207173735](https://www.openstreetmap.org/way/1207173735) | есть | есть | нет | нет | нет | 0.0 |
| 126 | 3543 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3543) | [way/1061737465](https://www.openstreetmap.org/way/1061737465) | есть | есть | нет | нет | нет | 0.0 |
| 127 | 3547 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3547) | [way/1206434234](https://www.openstreetmap.org/way/1206434234) | есть | есть | нет | нет | нет | 0.0 |
| 128 | 3548 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3548) | [way/1079021089](https://www.openstreetmap.org/way/1079021089) | есть | есть | нет | нет | нет | 0.0 |
| 129 | 3549 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3549) | [way/1126037590](https://www.openstreetmap.org/way/1126037590) | есть | есть | нет | нет | нет | 0.0 |
| 130 | 3556 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3556) | [way/1276208597](https://www.openstreetmap.org/way/1276208597) | есть | есть | нет | нет | нет | 0.2 |
| 131 | 3557 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3557) | [way/549425988](https://www.openstreetmap.org/way/549425988) | есть | есть | нет | нет | нет | 0.0 |
| 132 | 3562 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3562) | [way/1306916497](https://www.openstreetmap.org/way/1306916497) | есть | есть | нет | нет | нет | 0.0 |
| 133 | 3565 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3565) | [way/282713329](https://www.openstreetmap.org/way/282713329) | есть | есть | нет | нет | нет | 0.0 |
| 134 | 3569 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3569) | [way/352650181](https://www.openstreetmap.org/way/352650181) | есть | есть | нет | нет | нет | 0.0 |
| 135 | 3571 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3571) | [way/1131162724](https://www.openstreetmap.org/way/1131162724) | есть | есть | нет | нет | нет | 0.0 |
| 136 | 3572 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3572) | [way/1155911066](https://www.openstreetmap.org/way/1155911066) | есть | есть | нет | нет | нет | 1.5 |
| 137 | 3574 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3574) | [way/549065897](https://www.openstreetmap.org/way/549065897) | есть | есть | нет | нет | нет | 0.0 |
| 138 | 3582 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3582) | [way/1206891404](https://www.openstreetmap.org/way/1206891404) | есть | есть | нет | нет | нет | 0.0 |
| 139 | 3584 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3584) | [way/1207570052](https://www.openstreetmap.org/way/1207570052) | есть | есть | нет | нет | нет | 0.0 |
| 140 | 3591 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3591) | [way/1464351016](https://www.openstreetmap.org/way/1464351016) | есть | есть | нет | нет | нет | 0.0 |
| 141 | 3593 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3593) | [way/415939083](https://www.openstreetmap.org/way/415939083) | есть | есть | нет | нет | нет | 0.0 |
| 142 | 3596 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3596) | [way/506741612](https://www.openstreetmap.org/way/506741612) | есть | есть | нет | нет | нет | 0.0 |
| 143 | 3598 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3598) | [way/1165490174](https://www.openstreetmap.org/way/1165490174) | есть | есть | нет | нет | нет | 0.0 |
| 144 | 3602 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3602) | [way/549425939](https://www.openstreetmap.org/way/549425939) | есть | есть | нет | нет | нет | 0.0 |
| 145 | 3603 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3603) | [way/1206736155](https://www.openstreetmap.org/way/1206736155) | есть | есть | нет | нет | нет | 9.8 |
| 146 | 3604 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3604) | [way/1207569969](https://www.openstreetmap.org/way/1207569969) | есть | есть | нет | нет | нет | 0.0 |
| 147 | 3606 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3606) | [way/549065901](https://www.openstreetmap.org/way/549065901) | есть | есть | нет | нет | нет | 0.0 |
| 148 | 3610 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3610) | [way/352650176](https://www.openstreetmap.org/way/352650176) | есть | есть | нет | нет | нет | 0.0 |
| 149 | 3611 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3611) | [way/1155911057](https://www.openstreetmap.org/way/1155911057) | есть | есть | нет | нет | нет | 0.0 |
| 150 | 3615 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3615) | [way/549065898](https://www.openstreetmap.org/way/549065898) | есть | есть | нет | нет | нет | 0.7 |
| 151 | 3619 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3619) | [way/337432043](https://www.openstreetmap.org/way/337432043) | есть | есть | нет | нет | нет | 0.0 |
| 152 | 3622 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3622) | [way/549425997](https://www.openstreetmap.org/way/549425997) | есть | есть | нет | нет | нет | 0.0 |
| 153 | 3623 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3623) | [way/1207148738](https://www.openstreetmap.org/way/1207148738) | есть | есть | нет | нет | нет | 0.0 |
| 154 | 3625 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3625) | [way/1207570037](https://www.openstreetmap.org/way/1207570037) | есть | есть | нет | нет | нет | 0.0 |
| 155 | 3629 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3629) | [way/1206705391](https://www.openstreetmap.org/way/1206705391) | есть | есть | нет | нет | нет | 0.0 |
| 156 | 3630 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3630) | [way/1207173799](https://www.openstreetmap.org/way/1207173799) | есть | есть | нет | нет | нет | 0.0 |
| 157 | 3639 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3639) | [way/1207173797](https://www.openstreetmap.org/way/1207173797) | есть | есть | нет | нет | нет | 0.0 |
| 158 | 3643 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3643) | [way/1165479242](https://www.openstreetmap.org/way/1165479242) | есть | есть | нет | нет | нет | 0.0 |
| 159 | 3645 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3645) | [way/549065891](https://www.openstreetmap.org/way/549065891) | есть | есть | нет | нет | нет | 0.0 |
| 160 | 3653 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3653) | [way/282242711](https://www.openstreetmap.org/way/282242711) | есть | есть | нет | нет | нет | 0.0 |
| 161 | 3655 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3655) | [way/1206705394](https://www.openstreetmap.org/way/1206705394) | есть | есть | нет | нет | нет | 0.0 |
| 162 | 3660 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3660) | [way/1206891450](https://www.openstreetmap.org/way/1206891450) | есть | есть | нет | нет | нет | 0.0 |
| 163 | 3675 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3675) | [way/530821817](https://www.openstreetmap.org/way/530821817) | есть | есть | нет | нет | нет | 0.0 |
| 164 | 3676 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3676) | [way/641459431](https://www.openstreetmap.org/way/641459431) | есть | есть | нет | нет | нет | 0.0 |
| 165 | 3684 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3684) | [way/506741621](https://www.openstreetmap.org/way/506741621) | есть | есть | нет | нет | нет | 0.0 |
| 166 | 3685 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3685) | [way/1206434321](https://www.openstreetmap.org/way/1206434321) | есть | есть | нет | нет | нет | 0.0 |
| 167 | 3688 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3688) | [way/1207608127](https://www.openstreetmap.org/way/1207608127) | есть | есть | нет | нет | нет | 0.0 |
| 168 | 3689 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3689) | [way/1079021086](https://www.openstreetmap.org/way/1079021086) | есть | есть | нет | нет | нет | 0.0 |
| 169 | 3695 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3695) | [way/555209499](https://www.openstreetmap.org/way/555209499) | есть | есть | нет | нет | нет | 0.0 |
| 170 | 3698 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3698) | [way/937316002](https://www.openstreetmap.org/way/937316002) | есть | есть | нет | нет | нет | 0.3 |
| 171 | 3701 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3701) | [way/416306404](https://www.openstreetmap.org/way/416306404) | есть | есть | нет | нет | нет | 0.0 |
| 172 | 3702 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3702) | [way/416307057](https://www.openstreetmap.org/way/416307057) | есть | есть | нет | нет | нет | 0.0 |
| 173 | 3705 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3705) | [way/549425996](https://www.openstreetmap.org/way/549425996) | есть | есть | нет | нет | нет | 0.0 |
| 174 | 3709 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3709) | [way/1219711356](https://www.openstreetmap.org/way/1219711356) | есть | есть | нет | нет | нет | 0.0 |
| 175 | 3710 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3710) | [way/282627021](https://www.openstreetmap.org/way/282627021) | есть | есть | нет | нет | нет | 0.0 |
| 176 | 3718 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3718) | [way/549065887](https://www.openstreetmap.org/way/549065887) | есть | есть | нет | нет | нет | 0.0 |
| 177 | 3731 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3731) | [way/283175659](https://www.openstreetmap.org/way/283175659) | есть | есть | нет | нет | нет | 0.8 |
| 178 | 3736 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3736) | [way/1207197396](https://www.openstreetmap.org/way/1207197396) | есть | есть | нет | нет | нет | 15.2 |
| 179 | 3737 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3737) | [way/555209503](https://www.openstreetmap.org/way/555209503) | есть | есть | нет | нет | нет | 0.0 |
| 180 | 3738 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3738) | [way/78145658](https://www.openstreetmap.org/way/78145658) | есть | есть | нет | нет | нет | 0.0 |
| 181 | 3739 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3739) | [way/1216114749](https://www.openstreetmap.org/way/1216114749) | есть | есть | нет | нет | нет | 1.1 |
| 182 | 3746 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3746) | [way/1355047264](https://www.openstreetmap.org/way/1355047264) | есть | есть | нет | нет | нет | 0.0 |
| 183 | 3752 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3752) | [way/1362284683](https://www.openstreetmap.org/way/1362284683) | есть | есть | нет | нет | нет | 0.0 |
| 184 | 3753 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3753) | [way/549065888](https://www.openstreetmap.org/way/549065888) | есть | есть | нет | нет | нет | 0.0 |
| 185 | 3759 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3759) | [way/1061737466](https://www.openstreetmap.org/way/1061737466) | есть | есть | нет | нет | нет | 0.0 |
| 186 | 3761 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3761) | [way/310519024](https://www.openstreetmap.org/way/310519024) | есть | есть | нет | нет | нет | 0.0 |
| 187 | 3774 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3774) | [way/337431792](https://www.openstreetmap.org/way/337431792) | есть | есть | нет | нет | нет | 0.0 |
| 188 | 3775 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3775) | [way/1219711387](https://www.openstreetmap.org/way/1219711387) | есть | есть | нет | нет | нет | 0.0 |
| 189 | 3779 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3779) | [way/1075605526](https://www.openstreetmap.org/way/1075605526) | есть | есть | нет | нет | нет | 0.0 |
| 190 | 3780 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3780) | [way/1206736147](https://www.openstreetmap.org/way/1206736147) | есть | есть | нет | нет | нет | 7.2 |
| 191 | 3786 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3786) | [way/549065899](https://www.openstreetmap.org/way/549065899) | есть | есть | нет | нет | нет | 0.0 |
| 192 | 3788 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3788) | [way/1207148761](https://www.openstreetmap.org/way/1207148761) | есть | есть | нет | нет | нет | 0.0 |
| 193 | 3798 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3798) | [way/1206891460](https://www.openstreetmap.org/way/1206891460) | есть | есть | нет | нет | нет | 0.0 |
| 194 | 3802 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3802) | [way/1219711370](https://www.openstreetmap.org/way/1219711370) | есть | есть | нет | нет | нет | 0.0 |
| 195 | 3806 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3806) | [way/337435417](https://www.openstreetmap.org/way/337435417) | есть | есть | нет | нет | нет | 0.0 |
| 196 | 3815 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3815) | [way/1131162729](https://www.openstreetmap.org/way/1131162729) | есть | есть | нет | нет | нет | 0.0 |
| 197 | 3816 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3816) | [way/1131162732](https://www.openstreetmap.org/way/1131162732) | есть | есть | нет | нет | нет | 0.0 |
| 198 | 3817 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3817) | [way/411566026](https://www.openstreetmap.org/way/411566026) | есть | есть | есть | нет | нет | 0.0 |
| 199 | 3822 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3822) | [way/1206434212](https://www.openstreetmap.org/way/1206434212) | есть | есть | нет | нет | нет | 0.0 |
| 200 | 3825 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3825) | [way/1206575065](https://www.openstreetmap.org/way/1206575065) | есть | есть | нет | нет | нет | 0.0 |

## Ограничения перед добавлением в каталог

- Это первичная очередь из реестра охраняемого наследия, а не редакционное решение о публикации. Отсеять не отдельные здания, дубли комплексов, разрушенные/перестроенные объекты и неуместные для атласа записи.
- Найденные OSM-контуры локальны и имеют лицензию ODbL; перед включением подтвердить геометрию, закрытые кольца и соответствие конкретному корпусу. Не использовать точку реестра как геометрию.
- Сначала проверить исторические факты по первичному источнику, отдельно отличая датировку существующего корпуса от периода участка/комплекса.
- У каждого снимка проверить здание, ракурс, авторство, лицензию и отдельные права на архитектурное произведение.
- Place ID необязателен для исторической карточки; Google API запускать только отдельным согласованным батчем с допуском 5 м.

Генератор: `python3 scripts/create-next-200-report.py --output docs/research-next-200-v2.md --exclude-queue docs/research-next-200.md --label "следующие 200 объектов Тбилиси (вторая очередь)"`. Флаг `--exclude-queue` исключает записи предыдущей очереди по ID реестра и OSM way; для перезаписи существующего отчёта нужен `--force`. Данные реестра запрашиваются по HTTPS с проверкой сертификата.
