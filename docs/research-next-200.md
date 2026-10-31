# Исследовательская очередь: следующие 200 объектов Тбилиси

**Статус:** исследовательская очередь на момент отбора. В атлас добавлено 67 из 200 кандидатов; 133 остаются в исследовательском наборе до подтверждения корпуса, геометрии и исторических сведений. Результаты по добавленным объектам и конкретные пробелы — в [сводном отчёте](research-next-200-findings.md) и дополнительных проверках ниже.

Первые результаты исследования и Google API: [отдельные заметки](research-next-200-findings.md).

**Снимок:** 31 октября 2026 года. Контуры: © участники OpenStreetMap, [ODbL](https://www.openstreetmap.org/copyright).

## Основание и метод

- В официальном реестре найдено записей по Тбилиси: **2599**. Запрос: `Region=N'თბილისი'` к [слою недвижимых памятников](https://memkvidreoba.gov.ge/arcgisch/rest/services/CultureWMS/PS_ImmovableMonumentObjectP/MapServer/1).
- Сопоставление выполнено с 121,313 контурами из локальной OSM-выгрузки `raw/osm-tbilisi-building-outlines.geojson` и 100 текущими карточками.
- Отобраны записи с классификацией архитектуры, отдельным контуром OSM в радиусе примерно 17 м, без близкого совпадения с текущей карточкой атласа. Сначала взяты записи с конкретным названием и содержательным описанием.
- Сопоставление точки реестра с контуром автоматическое. Даже расстояние 0 м не подтверждает, что реестр и контур относятся к одному корпусу; каждую пару нужно проверить на карте и по адресу.
- Официальные текстовые поля не перепечатываются в этом отчёте: условия повторного использования данных реестра не установлены. Идентификаторы нужны для открытия карточек источника.

## Сводка пробелов для отобранных 200

| Поле / проверка | Не хватает или нужно проверить | Что известно сейчас |
|---|---:|---|
| Адрес в реестре | 0/200 без адреса | Наличие поля не заменяет проверку адреса и перевод на русский, английский и украинский |
| Датировка в реестре | 0/200 без `ExactDate`; 141/200 без четырёхзначного года в строке | Год в строке также требует проверки: он может относиться к перестройке или диапазону |
| Описание в реестре | 0/200 без описания | Тексты источника на грузинском требуют редакционной выжимки и перевода |
| Номер реестра | 22/200 без `RegistryN` | `ObjectID` и ссылка на источник остаются доступны |
| Архитектор | 198/200 без тега архитектора в сопоставленном OSM-контуре | Отдельного поля архитектора в схеме реестра нет; нужна профильная проверка для всех 200 |
| Стиль | 197/200 без `building:architecture` в OSM | У реестра нет отдельного поля стиля; классифицировать по источнику/фасаду для всех 200 |
| Фото | 162/200 без тега `wikimedia_commons` у контура | Для всех 200 ещё нет проверенной локальной галереи с автором, лицензией, источником и правами на изображённую архитектуру |
| Геометрия | 0/200 без близкого контура OSM; 9/200 точек реестра дальше 5 м от сопоставленного контура | Все 200 пар требуют ручного подтверждения принадлежности корпуса и качества Polygon |
| Переводы и карточка атласа | 200/200 | Нужны переводы имени, адреса и описания на ru/en/ka/uk, район, стиль/авторы с ID и редакционный текст |

## Список для ручной проверки

Таблица не содержит названий и адресов из реестра. Откройте карточку источника по ссылке; OSM way — только пространственный кандидат.

| № | ID реестра | Реестр | OSM way-кандидат | Адрес в источнике | Дата в источнике | Архитектор в OSM | Стиль в OSM | Commons-ссылка | Смещение точки, м |
|---:|---:|---|---|---|---|---|---|---|---:|
| 1 | 2676 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2676) | [way/1157284971](https://www.openstreetmap.org/way/1157284971) | есть | есть | нет | нет | нет | 0.0 |
| 2 | 2684 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2684) | [way/1278166606](https://www.openstreetmap.org/way/1278166606) | есть | есть | нет | нет | нет | 0.0 |
| 3 | 2694 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2694) | [way/691709671](https://www.openstreetmap.org/way/691709671) | есть | есть | нет | нет | есть | 0.0 |
| 4 | 2764 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2764) | [way/78500061](https://www.openstreetmap.org/way/78500061) | есть | есть | нет | нет | нет | 0.0 |
| 5 | 2780 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2780) | [way/78509293](https://www.openstreetmap.org/way/78509293) | есть | есть | нет | нет | нет | 0.0 |
| 6 | 2841 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2841) | [way/246757401](https://www.openstreetmap.org/way/246757401) | есть | есть | нет | нет | нет | 0.0 |
| 7 | 2850 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2850) | [way/218121310](https://www.openstreetmap.org/way/218121310) | есть | есть | нет | нет | нет | 0.0 |
| 8 | 2858 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2858) | [way/417138961](https://www.openstreetmap.org/way/417138961) | есть | есть | нет | нет | нет | 0.0 |
| 9 | 2902 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2902) | [way/1276208586](https://www.openstreetmap.org/way/1276208586) | есть | есть | нет | нет | нет | 0.0 |
| 10 | 2914 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2914) | [way/65158233](https://www.openstreetmap.org/way/65158233) | есть | есть | нет | нет | нет | 0.0 |
| 11 | 2986 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2986) | [way/565040626](https://www.openstreetmap.org/way/565040626) | есть | есть | нет | нет | нет | 0.0 |
| 12 | 2991 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2991) | [way/337421240](https://www.openstreetmap.org/way/337421240) | есть | есть | нет | нет | нет | 0.0 |
| 13 | 3016 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3016) | [way/57038408](https://www.openstreetmap.org/way/57038408) | есть | есть | нет | нет | есть | 0.0 |
| 14 | 3040 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3040) | [way/1484742676](https://www.openstreetmap.org/way/1484742676) | есть | есть | нет | нет | нет | 0.0 |
| 15 | 3049 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3049) | [way/246769267](https://www.openstreetmap.org/way/246769267) | есть | есть | нет | нет | есть | 0.0 |
| 16 | 3064 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3064) | [way/76960033](https://www.openstreetmap.org/way/76960033) | есть | есть | нет | нет | нет | 0.0 |
| 17 | 3069 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3069) | [way/108197961](https://www.openstreetmap.org/way/108197961) | есть | есть | нет | нет | нет | 0.0 |
| 18 | 3100 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3100) | [way/1365593642](https://www.openstreetmap.org/way/1365593642) | есть | есть | нет | нет | нет | 0.0 |
| 19 | 3108 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3108) | [way/1070396839](https://www.openstreetmap.org/way/1070396839) | есть | есть | нет | нет | есть | 0.0 |
| 20 | 3137 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3137) | [way/57037627](https://www.openstreetmap.org/way/57037627) | есть | есть | нет | нет | нет | 0.0 |
| 21 | 3173 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3173) | [way/1013499785](https://www.openstreetmap.org/way/1013499785) | есть | есть | нет | нет | нет | 0.0 |
| 22 | 3175 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3175) | [way/1218781712](https://www.openstreetmap.org/way/1218781712) | есть | есть | нет | нет | нет | 6.7 |
| 23 | 3178 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3178) | [way/462897308](https://www.openstreetmap.org/way/462897308) | есть | есть | нет | нет | есть | 0.0 |
| 24 | 3187 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3187) | [way/1188424739](https://www.openstreetmap.org/way/1188424739) | есть | есть | нет | нет | нет | 0.0 |
| 25 | 3190 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3190) | [way/1188424740](https://www.openstreetmap.org/way/1188424740) | есть | есть | нет | нет | нет | 0.0 |
| 26 | 3193 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3193) | [way/555413425](https://www.openstreetmap.org/way/555413425) | есть | есть | нет | нет | нет | 5.3 |
| 27 | 3227 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3227) | [way/282713323](https://www.openstreetmap.org/way/282713323) | есть | есть | нет | нет | есть | 0.0 |
| 28 | 3229 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3229) | [way/57037626](https://www.openstreetmap.org/way/57037626) | есть | есть | нет | нет | нет | 0.0 |
| 29 | 3239 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3239) | [way/217530856](https://www.openstreetmap.org/way/217530856) | есть | есть | нет | нет | нет | 0.0 |
| 30 | 3244 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3244) | [way/192201132](https://www.openstreetmap.org/way/192201132) | есть | есть | нет | нет | нет | 0.0 |
| 31 | 3246 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3246) | [way/102691273](https://www.openstreetmap.org/way/102691273) | есть | есть | нет | нет | нет | 0.0 |
| 32 | 3257 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3257) | [way/415940826](https://www.openstreetmap.org/way/415940826) | есть | есть | нет | нет | нет | 0.0 |
| 33 | 3303 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3303) | [way/462898536](https://www.openstreetmap.org/way/462898536) | есть | есть | нет | нет | есть | 0.0 |
| 34 | 3310 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3310) | [way/462897306](https://www.openstreetmap.org/way/462897306) | есть | есть | нет | нет | есть | 0.0 |
| 35 | 3321 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3321) | [way/462897300](https://www.openstreetmap.org/way/462897300) | есть | есть | нет | нет | нет | 0.0 |
| 36 | 3331 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3331) | [way/1217883918](https://www.openstreetmap.org/way/1217883918) | есть | есть | нет | нет | нет | 0.0 |
| 37 | 3332 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3332) | [way/78144732](https://www.openstreetmap.org/way/78144732) | есть | есть | нет | нет | нет | 0.0 |
| 38 | 3369 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3369) | [way/123574142](https://www.openstreetmap.org/way/123574142) | есть | есть | нет | нет | нет | 0.0 |
| 39 | 3386 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3386) | [way/661357924](https://www.openstreetmap.org/way/661357924) | есть | есть | нет | нет | есть | 0.0 |
| 40 | 3393 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3393) | [way/1219556099](https://www.openstreetmap.org/way/1219556099) | есть | есть | нет | нет | нет | 0.0 |
| 41 | 3397 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3397) | [way/758009917](https://www.openstreetmap.org/way/758009917) | есть | есть | нет | нет | нет | 0.0 |
| 42 | 3411 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3411) | [way/899099223](https://www.openstreetmap.org/way/899099223) | есть | есть | нет | нет | нет | 0.0 |
| 43 | 3432 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3432) | [way/198140489](https://www.openstreetmap.org/way/198140489) | есть | есть | нет | нет | нет | 0.0 |
| 44 | 3435 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3435) | [way/417693230](https://www.openstreetmap.org/way/417693230) | есть | есть | нет | нет | нет | 0.0 |
| 45 | 3450 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3450) | [way/1069038401](https://www.openstreetmap.org/way/1069038401) | есть | есть | нет | нет | нет | 0.0 |
| 46 | 3466 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3466) | [way/549065841](https://www.openstreetmap.org/way/549065841) | есть | есть | нет | нет | есть | 1.2 |
| 47 | 3486 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3486) | [way/817688095](https://www.openstreetmap.org/way/817688095) | есть | есть | нет | нет | есть | 0.0 |
| 48 | 3505 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3505) | [way/370845143](https://www.openstreetmap.org/way/370845143) | есть | есть | нет | есть | есть | 0.0 |
| 49 | 3506 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3506) | [way/282057534](https://www.openstreetmap.org/way/282057534) | есть | есть | нет | нет | нет | 0.0 |
| 50 | 3512 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3512) | [way/1206434249](https://www.openstreetmap.org/way/1206434249) | есть | есть | нет | нет | нет | 0.0 |
| 51 | 3534 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3534) | [way/198140507](https://www.openstreetmap.org/way/198140507) | есть | есть | нет | нет | нет | 0.0 |
| 52 | 3540 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3540) | [way/198125060](https://www.openstreetmap.org/way/198125060) | есть | есть | нет | нет | нет | 15.3 |
| 53 | 3567 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3567) | [way/282713325](https://www.openstreetmap.org/way/282713325) | есть | есть | нет | нет | нет | 0.0 |
| 54 | 3590 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3590) | [way/1207608184](https://www.openstreetmap.org/way/1207608184) | есть | есть | нет | нет | есть | 0.0 |
| 55 | 3592 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3592) | [way/415939084](https://www.openstreetmap.org/way/415939084) | есть | есть | нет | нет | нет | 0.0 |
| 56 | 3707 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3707) | [way/337364744](https://www.openstreetmap.org/way/337364744) | есть | есть | нет | нет | нет | 0.0 |
| 57 | 3735 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3735) | [way/591365819](https://www.openstreetmap.org/way/591365819) | есть | есть | нет | нет | есть | 0.0 |
| 58 | 3742 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3742) | [way/284620213](https://www.openstreetmap.org/way/284620213) | есть | есть | нет | нет | есть | 0.0 |
| 59 | 3756 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3756) | [way/1207148736](https://www.openstreetmap.org/way/1207148736) | есть | есть | нет | нет | нет | 7.6 |
| 60 | 3757 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3757) | [way/373390884](https://www.openstreetmap.org/way/373390884) | есть | есть | нет | нет | есть | 0.0 |
| 61 | 3758 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3758) | [way/75311175](https://www.openstreetmap.org/way/75311175) | есть | есть | нет | нет | нет | 0.0 |
| 62 | 3760 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3760) | [way/65275424](https://www.openstreetmap.org/way/65275424) | есть | есть | нет | нет | нет | 0.0 |
| 63 | 3777 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3777) | [way/73485191](https://www.openstreetmap.org/way/73485191) | есть | есть | нет | нет | нет | 0.0 |
| 64 | 3787 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3787) | [way/1206434174](https://www.openstreetmap.org/way/1206434174) | есть | есть | нет | нет | нет | 0.0 |
| 65 | 3823 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3823) | [way/188447905](https://www.openstreetmap.org/way/188447905) | есть | есть | нет | нет | нет | 0.0 |
| 66 | 3878 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3878) | [way/1172799960](https://www.openstreetmap.org/way/1172799960) | есть | есть | нет | нет | нет | 0.0 |
| 67 | 3886 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3886) | [way/549425978](https://www.openstreetmap.org/way/549425978) | есть | есть | нет | нет | нет | 0.0 |
| 68 | 3905 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3905) | [way/1426901042](https://www.openstreetmap.org/way/1426901042) | есть | есть | нет | нет | нет | 4.0 |
| 69 | 3957 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3957) | [way/282242687](https://www.openstreetmap.org/way/282242687) | есть | есть | нет | нет | нет | 0.6 |
| 70 | 4028 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4028) | [way/142657226](https://www.openstreetmap.org/way/142657226) | есть | есть | нет | нет | есть | 0.0 |
| 71 | 4030 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4030) | [way/1172799959](https://www.openstreetmap.org/way/1172799959) | есть | есть | нет | нет | нет | 0.0 |
| 72 | 4033 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4033) | [way/1193859179](https://www.openstreetmap.org/way/1193859179) | есть | есть | нет | нет | нет | 0.0 |
| 73 | 4070 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4070) | [way/337269648](https://www.openstreetmap.org/way/337269648) | есть | есть | нет | нет | есть | 0.0 |
| 74 | 4079 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4079) | [way/75316066](https://www.openstreetmap.org/way/75316066) | есть | есть | нет | нет | нет | 0.0 |
| 75 | 4157 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4157) | [way/1373529138](https://www.openstreetmap.org/way/1373529138) | есть | есть | нет | нет | нет | 0.0 |
| 76 | 4167 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4167) | [way/1305830046](https://www.openstreetmap.org/way/1305830046) | есть | есть | нет | нет | нет | 0.0 |
| 77 | 4171 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4171) | [way/294982340](https://www.openstreetmap.org/way/294982340) | есть | есть | нет | нет | нет | 9.6 |
| 78 | 4177 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4177) | [way/282045909](https://www.openstreetmap.org/way/282045909) | есть | есть | нет | нет | нет | 0.0 |
| 79 | 4185 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4185) | [way/1451986805](https://www.openstreetmap.org/way/1451986805) | есть | есть | нет | нет | есть | 0.0 |
| 80 | 4192 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4192) | [way/58078961](https://www.openstreetmap.org/way/58078961) | есть | есть | нет | нет | есть | 0.0 |
| 81 | 4209 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4209) | [way/174296550](https://www.openstreetmap.org/way/174296550) | есть | есть | нет | нет | нет | 0.0 |
| 82 | 4222 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4222) | [way/464080229](https://www.openstreetmap.org/way/464080229) | есть | есть | нет | нет | нет | 0.0 |
| 83 | 4235 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4235) | [way/77661969](https://www.openstreetmap.org/way/77661969) | есть | есть | нет | нет | нет | 0.0 |
| 84 | 4239 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4239) | [way/56677905](https://www.openstreetmap.org/way/56677905) | есть | есть | нет | нет | нет | 0.0 |
| 85 | 4272 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4272) | [way/1206575085](https://www.openstreetmap.org/way/1206575085) | есть | есть | нет | нет | нет | 0.0 |
| 86 | 4273 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4273) | [way/142656675](https://www.openstreetmap.org/way/142656675) | есть | есть | нет | нет | нет | 0.0 |
| 87 | 4306 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4306) | [way/25699467](https://www.openstreetmap.org/way/25699467) | есть | есть | есть | нет | нет | 0.0 |
| 88 | 4317 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4317) | [way/1429048941](https://www.openstreetmap.org/way/1429048941) | есть | есть | нет | нет | нет | 4.3 |
| 89 | 4375 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4375) | [way/555200496](https://www.openstreetmap.org/way/555200496) | есть | есть | нет | нет | нет | 0.0 |
| 90 | 4386 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4386) | [way/282231532](https://www.openstreetmap.org/way/282231532) | есть | есть | нет | нет | нет | 0.0 |
| 91 | 4414 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4414) | [way/198114602](https://www.openstreetmap.org/way/198114602) | есть | есть | нет | нет | нет | 0.0 |
| 92 | 4493 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4493) | [way/44709683](https://www.openstreetmap.org/way/44709683) | есть | есть | нет | нет | нет | 0.0 |
| 93 | 4608 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4608) | [way/190038732](https://www.openstreetmap.org/way/190038732) | есть | есть | нет | нет | нет | 0.0 |
| 94 | 4641 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4641) | [way/25699483](https://www.openstreetmap.org/way/25699483) | есть | есть | нет | нет | есть | 0.0 |
| 95 | 4666 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4666) | [way/1159768301](https://www.openstreetmap.org/way/1159768301) | есть | есть | нет | нет | нет | 0.0 |
| 96 | 4668 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4668) | [way/78005878](https://www.openstreetmap.org/way/78005878) | есть | есть | нет | нет | нет | 0.0 |
| 97 | 4688 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4688) | [way/588856761](https://www.openstreetmap.org/way/588856761) | есть | есть | нет | нет | нет | 11.6 |
| 98 | 4751 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4751) | [way/38326853](https://www.openstreetmap.org/way/38326853) | есть | есть | нет | нет | есть | 0.0 |
| 99 | 4800 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4800) | [way/190587065](https://www.openstreetmap.org/way/190587065) | есть | есть | нет | нет | нет | 0.0 |
| 100 | 4819 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4819) | [way/190475629](https://www.openstreetmap.org/way/190475629) | есть | есть | нет | нет | нет | 6.0 |
| 101 | 4896 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4896) | [way/198114600](https://www.openstreetmap.org/way/198114600) | есть | есть | нет | нет | нет | 0.0 |
| 102 | 4944 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4944) | [way/1236448832](https://www.openstreetmap.org/way/1236448832) | есть | есть | есть | есть | есть | 3.1 |
| 103 | 4946 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4946) | [way/1163438218](https://www.openstreetmap.org/way/1163438218) | есть | есть | нет | нет | нет | 1.5 |
| 104 | 4948 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4948) | [way/1163438210](https://www.openstreetmap.org/way/1163438210) | есть | есть | нет | есть | нет | 0.0 |
| 105 | 5000 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5000) | [way/34148385](https://www.openstreetmap.org/way/34148385) | есть | есть | нет | нет | есть | 0.0 |
| 106 | 5004 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5004) | [way/531596101](https://www.openstreetmap.org/way/531596101) | есть | есть | нет | нет | нет | 0.0 |
| 107 | 5006 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5006) | [way/135869289](https://www.openstreetmap.org/way/135869289) | есть | есть | нет | нет | есть | 0.0 |
| 108 | 5007 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5007) | [way/415585844](https://www.openstreetmap.org/way/415585844) | есть | есть | нет | нет | нет | 0.0 |
| 109 | 5008 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5008) | [way/415585842](https://www.openstreetmap.org/way/415585842) | есть | есть | нет | нет | нет | 0.0 |
| 110 | 5047 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5047) | [way/78390490](https://www.openstreetmap.org/way/78390490) | есть | есть | нет | нет | нет | 0.0 |
| 111 | 5208 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5208) | [way/76960034](https://www.openstreetmap.org/way/76960034) | есть | есть | нет | нет | нет | 0.0 |
| 112 | 15996 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=15996) | [way/337421300](https://www.openstreetmap.org/way/337421300) | есть | есть | нет | нет | нет | 0.0 |
| 113 | 16002 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16002) | [way/173131485](https://www.openstreetmap.org/way/173131485) | есть | есть | нет | нет | нет | 0.0 |
| 114 | 16003 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16003) | [way/189826202](https://www.openstreetmap.org/way/189826202) | есть | есть | нет | нет | нет | 15.4 |
| 115 | 16025 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16025) | [way/1246282541](https://www.openstreetmap.org/way/1246282541) | есть | есть | нет | нет | нет | 0.0 |
| 116 | 16047 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16047) | [way/337851293](https://www.openstreetmap.org/way/337851293) | есть | есть | нет | нет | нет | 0.0 |
| 117 | 16052 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16052) | [way/1274260082](https://www.openstreetmap.org/way/1274260082) | есть | есть | нет | нет | нет | 0.0 |
| 118 | 16057 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16057) | [way/478568522](https://www.openstreetmap.org/way/478568522) | есть | есть | нет | нет | нет | 0.0 |
| 119 | 26717 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=26717) | [way/641462736](https://www.openstreetmap.org/way/641462736) | есть | есть | нет | нет | нет | 0.0 |
| 120 | 4071 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4071) | [way/129840872](https://www.openstreetmap.org/way/129840872) | есть | есть | нет | нет | есть | 0.0 |
| 121 | 4583 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4583) | [way/242224841](https://www.openstreetmap.org/way/242224841) | есть | есть | нет | нет | нет | 0.3 |
| 122 | 3347 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3347) | [way/1217883895](https://www.openstreetmap.org/way/1217883895) | есть | есть | нет | нет | нет | 0.0 |
| 123 | 3484 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3484) | [way/295188423](https://www.openstreetmap.org/way/295188423) | есть | есть | нет | нет | нет | 0.0 |
| 124 | 4016 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4016) | [way/1080996079](https://www.openstreetmap.org/way/1080996079) | есть | есть | нет | нет | нет | 0.0 |
| 125 | 4436 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4436) | [way/365098623](https://www.openstreetmap.org/way/365098623) | есть | есть | нет | нет | нет | 0.0 |
| 126 | 3099 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3099) | [way/1289207833](https://www.openstreetmap.org/way/1289207833) | есть | есть | нет | нет | нет | 1.6 |
| 127 | 3773 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3773) | [way/1217883916](https://www.openstreetmap.org/way/1217883916) | есть | есть | нет | нет | нет | 0.0 |
| 128 | 2965 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2965) | [way/1365593651](https://www.openstreetmap.org/way/1365593651) | есть | есть | нет | нет | нет | 0.1 |
| 129 | 3377 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3377) | [way/143349273](https://www.openstreetmap.org/way/143349273) | есть | есть | нет | нет | нет | 0.0 |
| 130 | 2671 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2671) | [way/1225299270](https://www.openstreetmap.org/way/1225299270) | есть | есть | нет | нет | нет | 0.0 |
| 131 | 3326 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3326) | [way/78145184](https://www.openstreetmap.org/way/78145184) | есть | есть | нет | нет | нет | 0.0 |
| 132 | 3469 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3469) | [way/337365207](https://www.openstreetmap.org/way/337365207) | есть | есть | нет | нет | нет | 0.0 |
| 133 | 4393 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4393) | [way/224748690](https://www.openstreetmap.org/way/224748690) | есть | есть | нет | нет | нет | 0.0 |
| 134 | 3362 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3362) | [way/220702092](https://www.openstreetmap.org/way/220702092) | есть | есть | нет | нет | есть | 0.0 |
| 135 | 3690 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3690) | [way/337364751](https://www.openstreetmap.org/way/337364751) | есть | есть | нет | нет | нет | 0.0 |
| 136 | 2849 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2849) | [way/1225299272](https://www.openstreetmap.org/way/1225299272) | есть | есть | нет | нет | нет | 1.8 |
| 137 | 4101 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4101) | [way/555200386](https://www.openstreetmap.org/way/555200386) | есть | есть | нет | нет | есть | 0.0 |
| 138 | 3447 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3447) | [way/1262673998](https://www.openstreetmap.org/way/1262673998) | есть | есть | нет | нет | нет | 0.0 |
| 139 | 4442 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4442) | [way/159818810](https://www.openstreetmap.org/way/159818810) | есть | есть | нет | нет | нет | 0.0 |
| 140 | 3388 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3388) | [way/57403663](https://www.openstreetmap.org/way/57403663) | есть | есть | нет | нет | есть | 0.0 |
| 141 | 3336 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3336) | [way/1222201489](https://www.openstreetmap.org/way/1222201489) | есть | есть | нет | нет | нет | 0.0 |
| 142 | 3657 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3657) | [way/503328572](https://www.openstreetmap.org/way/503328572) | есть | есть | нет | нет | нет | 0.0 |
| 143 | 3847 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3847) | [way/337365203](https://www.openstreetmap.org/way/337365203) | есть | есть | нет | нет | нет | 0.0 |
| 144 | 4763 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4763) | [way/1234716193](https://www.openstreetmap.org/way/1234716193) | есть | есть | нет | нет | есть | 0.0 |
| 145 | 3339 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3339) | [way/123574122](https://www.openstreetmap.org/way/123574122) | есть | есть | нет | нет | есть | 0.0 |
| 146 | 4932 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4932) | [way/242179595](https://www.openstreetmap.org/way/242179595) | есть | есть | нет | нет | нет | 0.0 |
| 147 | 3317 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3317) | [way/1207173706](https://www.openstreetmap.org/way/1207173706) | есть | есть | нет | нет | нет | 0.0 |
| 148 | 3058 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3058) | [way/246785818](https://www.openstreetmap.org/way/246785818) | есть | есть | нет | нет | нет | 0.0 |
| 149 | 4711 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4711) | [way/78004768](https://www.openstreetmap.org/way/78004768) | есть | есть | нет | нет | нет | 0.0 |
| 150 | 16022 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16022) | [way/1312915852](https://www.openstreetmap.org/way/1312915852) | есть | есть | нет | нет | нет | 0.0 |
| 151 | 3082 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3082) | [way/218120847](https://www.openstreetmap.org/way/218120847) | есть | есть | нет | нет | нет | 0.0 |
| 152 | 2888 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2888) | [way/1278166560](https://www.openstreetmap.org/way/1278166560) | есть | есть | нет | нет | нет | 0.0 |
| 153 | 2928 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2928) | [way/336997938](https://www.openstreetmap.org/way/336997938) | есть | есть | нет | нет | нет | 0.0 |
| 154 | 3723 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3723) | [way/680607569](https://www.openstreetmap.org/way/680607569) | есть | есть | нет | нет | есть | 0.0 |
| 155 | 3821 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3821) | [way/294971081](https://www.openstreetmap.org/way/294971081) | есть | есть | нет | нет | нет | 0.0 |
| 156 | 3290 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3290) | [way/147665174](https://www.openstreetmap.org/way/147665174) | есть | есть | нет | нет | нет | 0.0 |
| 157 | 2713 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2713) | [way/1069053608](https://www.openstreetmap.org/way/1069053608) | есть | есть | нет | нет | нет | 0.0 |
| 158 | 3664 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3664) | [way/1206434300](https://www.openstreetmap.org/way/1206434300) | есть | есть | нет | нет | нет | 0.0 |
| 159 | 3714 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3714) | [way/278885372](https://www.openstreetmap.org/way/278885372) | есть | есть | нет | нет | нет | 0.0 |
| 160 | 4002 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4002) | [way/1206434315](https://www.openstreetmap.org/way/1206434315) | есть | есть | нет | нет | нет | 3.4 |
| 161 | 4945 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4945) | [way/73412942](https://www.openstreetmap.org/way/73412942) | есть | есть | нет | нет | есть | 0.0 |
| 162 | 2956 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2956) | [way/246783230](https://www.openstreetmap.org/way/246783230) | есть | есть | нет | нет | нет | 3.9 |
| 163 | 3135 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3135) | [way/1127991564](https://www.openstreetmap.org/way/1127991564) | есть | есть | нет | нет | нет | 0.0 |
| 164 | 2755 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2755) | [way/465566841](https://www.openstreetmap.org/way/465566841) | есть | есть | нет | нет | нет | 0.0 |
| 165 | 3626 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3626) | [way/549425991](https://www.openstreetmap.org/way/549425991) | есть | есть | нет | нет | есть | 0.0 |
| 166 | 3792 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3792) | [way/337432044](https://www.openstreetmap.org/way/337432044) | есть | есть | нет | нет | нет | 0.0 |
| 167 | 4721 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4721) | [way/1125012315](https://www.openstreetmap.org/way/1125012315) | есть | есть | нет | нет | нет | 0.0 |
| 168 | 4579 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4579) | [way/242179594](https://www.openstreetmap.org/way/242179594) | есть | есть | нет | нет | нет | 0.0 |
| 169 | 3906 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3906) | [way/1206434257](https://www.openstreetmap.org/way/1206434257) | есть | есть | нет | нет | нет | 0.0 |
| 170 | 3824 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3824) | [way/282034921](https://www.openstreetmap.org/way/282034921) | есть | есть | нет | нет | нет | 0.0 |
| 171 | 3495 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3495) | [way/337364748](https://www.openstreetmap.org/way/337364748) | есть | есть | нет | нет | нет | 0.0 |
| 172 | 4162 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4162) | [way/1231994177](https://www.openstreetmap.org/way/1231994177) | есть | есть | нет | нет | нет | 0.0 |
| 173 | 3683 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3683) | [way/1066392727](https://www.openstreetmap.org/way/1066392727) | есть | есть | нет | нет | нет | 0.0 |
| 174 | 3819 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3819) | [way/242191025](https://www.openstreetmap.org/way/242191025) | есть | есть | нет | нет | нет | 0.0 |
| 175 | 3172 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3172) | [way/462897307](https://www.openstreetmap.org/way/462897307) | есть | есть | нет | нет | есть | 0.0 |
| 176 | 3319 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3319) | [way/733122416](https://www.openstreetmap.org/way/733122416) | есть | есть | нет | нет | нет | 0.0 |
| 177 | 5003 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5003) | [way/901102995](https://www.openstreetmap.org/way/901102995) | есть | есть | нет | нет | нет | 0.0 |
| 178 | 3647 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3647) | [way/1220380979](https://www.openstreetmap.org/way/1220380979) | есть | есть | нет | нет | нет | 0.5 |
| 179 | 4103 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4103) | [way/159818820](https://www.openstreetmap.org/way/159818820) | есть | есть | нет | нет | нет | 0.0 |
| 180 | 4304 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4304) | [way/254277285](https://www.openstreetmap.org/way/254277285) | есть | есть | нет | нет | нет | 0.0 |
| 181 | 2864 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2864) | [way/1269152262](https://www.openstreetmap.org/way/1269152262) | есть | есть | нет | нет | нет | 0.0 |
| 182 | 4369 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4369) | [way/1206575093](https://www.openstreetmap.org/way/1206575093) | есть | есть | нет | нет | есть | 0.0 |
| 183 | 3219 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3219) | [way/282471403](https://www.openstreetmap.org/way/282471403) | есть | есть | нет | нет | есть | 0.0 |
| 184 | 4919 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4919) | [way/242224837](https://www.openstreetmap.org/way/242224837) | есть | есть | нет | нет | нет | 0.0 |
| 185 | 4761 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4761) | [way/77639317](https://www.openstreetmap.org/way/77639317) | есть | есть | нет | нет | нет | 0.0 |
| 186 | 3743 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3743) | [way/77899499](https://www.openstreetmap.org/way/77899499) | есть | есть | нет | нет | нет | 0.0 |
| 187 | 3851 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3851) | [way/1207148734](https://www.openstreetmap.org/way/1207148734) | есть | есть | нет | нет | нет | 13.5 |
| 188 | 3874 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3874) | [way/337365206](https://www.openstreetmap.org/way/337365206) | есть | есть | нет | нет | нет | 0.0 |
| 189 | 3692 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3692) | [way/549425902](https://www.openstreetmap.org/way/549425902) | есть | есть | нет | нет | нет | 0.0 |
| 190 | 3550 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3550) | [way/1217416149](https://www.openstreetmap.org/way/1217416149) | есть | есть | нет | нет | нет | 0.0 |
| 191 | 3662 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3662) | [way/706233174](https://www.openstreetmap.org/way/706233174) | есть | есть | нет | нет | нет | 0.0 |
| 192 | 3751 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3751) | [way/1217416151](https://www.openstreetmap.org/way/1217416151) | есть | есть | нет | нет | нет | 0.0 |
| 193 | 5009 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5009) | [way/78357093](https://www.openstreetmap.org/way/78357093) | есть | есть | нет | нет | нет | 0.0 |
| 194 | 2792 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2792) | [way/375520108](https://www.openstreetmap.org/way/375520108) | есть | есть | нет | нет | нет | 0.0 |
| 195 | 3443 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3443) | [way/337364749](https://www.openstreetmap.org/way/337364749) | есть | есть | нет | нет | нет | 0.0 |
| 196 | 3968 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3968) | [way/77893810](https://www.openstreetmap.org/way/77893810) | есть | есть | нет | нет | нет | 0.0 |
| 197 | 3315 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3315) | [way/282471274](https://www.openstreetmap.org/way/282471274) | есть | есть | нет | нет | нет | 0.0 |
| 198 | 3526 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3526) | [way/1207148722](https://www.openstreetmap.org/way/1207148722) | есть | есть | нет | нет | нет | 2.2 |
| 199 | 3005 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3005) | [way/132312112](https://www.openstreetmap.org/way/132312112) | есть | есть | нет | нет | есть | 0.0 |
| 200 | 3911 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3911) | [way/338830393](https://www.openstreetmap.org/way/338830393) | есть | есть | нет | нет | нет | 0.0 |

## Ограничения перед добавлением в каталог

- Это первичная очередь из реестра охраняемого наследия, а не редакционное решение о публикации. Отсеять не отдельные здания, дубли комплексов, разрушенные/перестроенные объекты и неуместные для атласа записи.
- Найденные OSM-контуры локальны и имеют лицензию ODbL; перед включением подтвердить геометрию, закрытые кольца и соответствие конкретному корпусу. Не использовать точку реестра как геометрию.
- Сначала проверить исторические факты по первичному источнику, отдельно отличая датировку существующего корпуса от периода участка/комплекса.
- У каждого снимка проверить здание, ракурс, авторство, лицензию и отдельные права на архитектурное произведение.
- Place ID необязателен для исторической карточки; Google API запускать только отдельным согласованным батчем с допуском 5 м.

Генератор очереди: `python3 scripts/create-next-200-report.py`. Данные реестра запрашиваются по HTTPS с проверкой сертификата; при ошибке скрипт останавливается.
