# Исследовательская очередь: следующие 200 объектов Тбилиси (вторая очередь)

**Статус:** очередь кандидатов для редакционной проверки; эти записи ещё не добавлены в каталог атласа и не разбирались.

Предыдущая очередь: [research-next-200.md](research-next-200.md), её итоги — в [регистре](research-queue-progress.md) и [отчёте волны 4](research-queue-wave-4.md). Эта очередь только подготовлена: карточек из неё ещё нет, факты не проверялись.

**Снимок:** 2026-10-31 UTC. Контуры: © участники OpenStreetMap, [ODbL](https://www.openstreetmap.org/copyright).

## Основание и метод

- В официальном реестре найдено записей по Тбилиси: **2599**. Запрос: `Region=N'თბილისი'` к [слою недвижимых памятников](https://memkvidreoba.gov.ge/arcgisch/rest/services/CultureWMS/PS_ImmovableMonumentObjectP/MapServer/1).
- Сопоставление выполнено с 121,313 контурами из локальной OSM-выгрузки `raw/osm-tbilisi-building-outlines.geojson` и 176 карточками атласа на момент отбора.
- Отобраны записи с классификацией архитектуры, отдельным контуром OSM в радиусе примерно 17 м, без близкого совпадения или значительного пересечения с текущей карточкой атласа. Сначала взяты записи с конкретным названием и содержательным описанием.
- Исключены все записи предыдущих очередей: `docs/research-next-200.md`. Это не даёт повторно отобрать уже разобранных кандидатов.
- Сопоставление точки реестра с контуром автоматическое. Даже расстояние 0 м не подтверждает, что реестр и контур относятся к одному корпусу; каждую пару нужно проверить на карте и по адресу.
- Официальные текстовые поля не перепечатываются в этом отчёте: условия повторного использования данных реестра не установлены. Идентификаторы нужны для открытия карточек источника.

## Сводка пробелов для отобранных 200

| Поле / проверка | Не хватает или нужно проверить | Что известно сейчас |
|---|---:|---|
| Адрес в реестре | 87/200 без адреса | Наличие поля не заменяет проверку адреса и перевод на русский, английский и украинский |
| Датировка в реестре | 68/200 без `ExactDate`; 160/200 без четырёхзначного года в строке | Год в строке также требует проверки: он может относиться к перестройке или диапазону |
| Описание в реестре | 0/200 без описания | Тексты источника на грузинском требуют редакционной выжимки и перевода |
| Номер реестра | 136/200 без `RegistryN` | `ObjectID` и ссылка на источник остаются доступны |
| Архитектор | 195/200 без тега архитектора в сопоставленном OSM-контуре | Отдельного поля архитектора в схеме реестра нет; нужна профильная проверка |
| Стиль | 195/200 без `building:architecture` в OSM | У реестра нет отдельного поля стиля; классифицировать по источнику/фасаду |
| Фото | 182/200 без тега `wikimedia_commons` у контура | Проверенной локальной галереи с автором, лицензией и правами пока нет |
| Геометрия | 0/200 без близкого контура OSM; 25/200 точек реестра дальше 5 м от сопоставленного контура | Все пары требуют ручного подтверждения принадлежности корпуса и качества Polygon |
| Переводы и карточка атласа | 200/200 | Нужны переводы имени, адреса и описания на ru/en/ka/uk, район, стиль/авторы с ID и редакционный текст |

## Список для ручной проверки

Таблица не содержит названий и адресов из реестра. Откройте карточку источника по ссылке; OSM way — только пространственный кандидат.

| № | ID реестра | Реестр | OSM way-кандидат | Адрес в источнике | Дата в источнике | Архитектор в OSM | Стиль в OSM | Commons-ссылка | Смещение точки, м |
|---:|---:|---|---|---|---|---|---|---|---:|
| 1 | 2943 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2943) | [way/246785820](https://www.openstreetmap.org/way/246785820) | есть | есть | нет | нет | нет | 0.0 |
| 2 | 5010 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5010) | [way/78252000](https://www.openstreetmap.org/way/78252000) | есть | есть | нет | нет | нет | 1.4 |
| 3 | 2781 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2781) | [way/1312896926](https://www.openstreetmap.org/way/1312896926) | есть | есть | нет | нет | нет | 0.0 |
| 4 | 3524 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3524) | [way/1206705438](https://www.openstreetmap.org/way/1206705438) | есть | есть | нет | нет | нет | 0.0 |
| 5 | 2998 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2998) | [way/246757432](https://www.openstreetmap.org/way/246757432) | есть | есть | нет | нет | нет | 0.0 |
| 6 | 3055 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3055) | [way/337386294](https://www.openstreetmap.org/way/337386294) | есть | есть | нет | нет | нет | 0.0 |
| 7 | 3302 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3302) | [way/1069051421](https://www.openstreetmap.org/way/1069051421) | есть | есть | нет | нет | нет | 0.0 |
| 8 | 3501 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3501) | [way/77901116](https://www.openstreetmap.org/way/77901116) | есть | есть | нет | нет | нет | 0.0 |
| 9 | 4274 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4274) | [way/188562918](https://www.openstreetmap.org/way/188562918) | есть | есть | нет | нет | нет | 0.0 |
| 10 | 3358 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3358) | [way/706146695](https://www.openstreetmap.org/way/706146695) | есть | есть | нет | нет | нет | 8.0 |
| 11 | 3072 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3072) | [way/186560123](https://www.openstreetmap.org/way/186560123) | есть | есть | нет | нет | нет | 0.0 |
| 12 | 4271 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4271) | [way/1077498264](https://www.openstreetmap.org/way/1077498264) | есть | есть | нет | нет | нет | 0.0 |
| 13 | 4515 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4515) | [way/559446309](https://www.openstreetmap.org/way/559446309) | есть | есть | нет | нет | есть | 0.0 |
| 14 | 4023 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4023) | [way/464080231](https://www.openstreetmap.org/way/464080231) | есть | есть | нет | нет | нет | 0.0 |
| 15 | 2935 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2935) | [way/416312514](https://www.openstreetmap.org/way/416312514) | есть | есть | нет | нет | нет | 8.5 |
| 16 | 4593 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4593) | [way/641459423](https://www.openstreetmap.org/way/641459423) | есть | есть | нет | нет | нет | 16.5 |
| 17 | 3420 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3420) | [way/57403659](https://www.openstreetmap.org/way/57403659) | есть | есть | нет | нет | есть | 0.0 |
| 18 | 2980 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2980) | [way/375520107](https://www.openstreetmap.org/way/375520107) | есть | есть | нет | нет | нет | 0.0 |
| 19 | 3348 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3348) | [way/1136648246](https://www.openstreetmap.org/way/1136648246) | есть | есть | нет | нет | нет | 0.0 |
| 20 | 13549 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=13549) | [way/1473011350](https://www.openstreetmap.org/way/1473011350) | есть | есть | нет | нет | нет | 0.0 |
| 21 | 3269 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3269) | [way/218120850](https://www.openstreetmap.org/way/218120850) | есть | есть | нет | нет | нет | 0.0 |
| 22 | 3268 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3268) | [way/1127957414](https://www.openstreetmap.org/way/1127957414) | есть | есть | нет | нет | нет | 0.0 |
| 23 | 3312 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3312) | [way/1127991546](https://www.openstreetmap.org/way/1127991546) | есть | есть | нет | нет | нет | 0.0 |
| 24 | 3262 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3262) | [way/1070395563](https://www.openstreetmap.org/way/1070395563) | есть | есть | нет | нет | нет | 0.0 |
| 25 | 2896 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2896) | [way/1268819923](https://www.openstreetmap.org/way/1268819923) | есть | есть | нет | нет | нет | 0.0 |
| 26 | 2957 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2957) | [way/246787187](https://www.openstreetmap.org/way/246787187) | есть | есть | нет | нет | нет | 0.0 |
| 27 | 12054 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=12054) | [way/1299576763](https://www.openstreetmap.org/way/1299576763) | есть | есть | нет | нет | нет | 0.0 |
| 28 | 3000 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3000) | [way/1312896924](https://www.openstreetmap.org/way/1312896924) | есть | есть | нет | нет | нет | 0.0 |
| 29 | 3699 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3699) | [way/1207148759](https://www.openstreetmap.org/way/1207148759) | есть | есть | нет | нет | нет | 0.0 |
| 30 | 3460 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3460) | [way/1070391880](https://www.openstreetmap.org/way/1070391880) | есть | есть | нет | нет | нет | 0.0 |
| 31 | 16023 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16023) | [way/241776816](https://www.openstreetmap.org/way/241776816) | есть | есть | нет | нет | нет | 0.0 |
| 32 | 4293 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4293) | [way/75315956](https://www.openstreetmap.org/way/75315956) | есть | есть | нет | нет | есть | 4.8 |
| 33 | 3812 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3812) | [way/1127957418](https://www.openstreetmap.org/way/1127957418) | есть | есть | нет | нет | нет | 0.0 |
| 34 | 3153 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3153) | [way/463651693](https://www.openstreetmap.org/way/463651693) | есть | есть | нет | нет | нет | 0.0 |
| 35 | 4921 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4921) | [way/1477852229](https://www.openstreetmap.org/way/1477852229) | есть | есть | нет | нет | нет | 2.8 |
| 36 | 17378 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=17378) | [way/193893099](https://www.openstreetmap.org/way/193893099) | есть | есть | нет | нет | нет | 0.0 |
| 37 | 3044 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3044) | [way/1381834673](https://www.openstreetmap.org/way/1381834673) | есть | есть | нет | нет | нет | 0.0 |
| 38 | 16011 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16011) | [way/284719990](https://www.openstreetmap.org/way/284719990) | есть | есть | нет | нет | нет | 0.0 |
| 39 | 3441 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3441) | [way/362739744](https://www.openstreetmap.org/way/362739744) | есть | есть | есть | нет | есть | 2.4 |
| 40 | 4838 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4838) | [way/65251744](https://www.openstreetmap.org/way/65251744) | есть | есть | нет | нет | нет | 0.0 |
| 41 | 3333 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3333) | [way/362739743](https://www.openstreetmap.org/way/362739743) | есть | есть | нет | нет | нет | 0.0 |
| 42 | 4663 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4663) | [way/1234448342](https://www.openstreetmap.org/way/1234448342) | есть | есть | нет | нет | нет | 0.0 |
| 43 | 3166 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3166) | [way/1286124291](https://www.openstreetmap.org/way/1286124291) | есть | есть | нет | нет | нет | 0.0 |
| 44 | 2880 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2880) | [way/1350339021](https://www.openstreetmap.org/way/1350339021) | есть | есть | нет | нет | нет | 0.0 |
| 45 | 5001 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5001) | [way/75322033](https://www.openstreetmap.org/way/75322033) | есть | есть | нет | нет | нет | 0.0 |
| 46 | 16031 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16031) | [way/188314346](https://www.openstreetmap.org/way/188314346) | есть | есть | нет | нет | нет | 0.0 |
| 47 | 4168 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4168) | [way/641459402](https://www.openstreetmap.org/way/641459402) | есть | есть | нет | нет | нет | 5.2 |
| 48 | 24317 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24317) | [way/1361095746](https://www.openstreetmap.org/way/1361095746) | есть | есть | нет | нет | нет | 0.0 |
| 49 | 2869 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2869) | [way/246787173](https://www.openstreetmap.org/way/246787173) | есть | есть | нет | нет | нет | 0.0 |
| 50 | 3833 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3833) | [way/188562912](https://www.openstreetmap.org/way/188562912) | есть | есть | нет | нет | нет | 0.0 |
| 51 | 3125 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3125) | [way/1069051424](https://www.openstreetmap.org/way/1069051424) | есть | есть | нет | нет | нет | 0.0 |
| 52 | 4653 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4653) | [way/78492225](https://www.openstreetmap.org/way/78492225) | есть | есть | нет | нет | нет | 0.0 |
| 53 | 4308 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4308) | [way/224342561](https://www.openstreetmap.org/way/224342561) | есть | есть | нет | нет | нет | 0.0 |
| 54 | 4512 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4512) | [way/1254388507](https://www.openstreetmap.org/way/1254388507) | есть | есть | нет | есть | нет | 13.8 |
| 55 | 4769 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4769) | [way/224358619](https://www.openstreetmap.org/way/224358619) | есть | есть | нет | нет | нет | 0.0 |
| 56 | 4951 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4951) | [way/1204376656](https://www.openstreetmap.org/way/1204376656) | есть | есть | нет | нет | нет | 0.0 |
| 57 | 5052 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5052) | [way/1235293117](https://www.openstreetmap.org/way/1235293117) | есть | есть | нет | нет | нет | 15.3 |
| 58 | 4764 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4764) | [way/287753990](https://www.openstreetmap.org/way/287753990) | есть | есть | нет | нет | нет | 0.0 |
| 59 | 2753 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2753) | [way/246787160](https://www.openstreetmap.org/way/246787160) | есть | есть | нет | нет | нет | 6.8 |
| 60 | 17471 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=17471) | [way/1225051073](https://www.openstreetmap.org/way/1225051073) | есть | есть | нет | нет | нет | 0.0 |
| 61 | 2974 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2974) | [way/246783298](https://www.openstreetmap.org/way/246783298) | есть | есть | нет | нет | нет | 0.0 |
| 62 | 3504 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3504) | [way/549065884](https://www.openstreetmap.org/way/549065884) | есть | есть | нет | нет | нет | 0.2 |
| 63 | 2736 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2736) | [way/246787217](https://www.openstreetmap.org/way/246787217) | есть | есть | нет | нет | нет | 0.0 |
| 64 | 3451 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3451) | [way/1206891432](https://www.openstreetmap.org/way/1206891432) | есть | есть | нет | нет | нет | 1.3 |
| 65 | 4699 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4699) | [way/242103598](https://www.openstreetmap.org/way/242103598) | есть | есть | нет | нет | нет | 0.0 |
| 66 | 3831 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3831) | [way/77907756](https://www.openstreetmap.org/way/77907756) | есть | есть | нет | нет | нет | 0.0 |
| 67 | 24768 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24768) | [way/370845141](https://www.openstreetmap.org/way/370845141) | есть | есть | нет | нет | нет | 2.4 |
| 68 | 3873 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3873) | [way/33704429](https://www.openstreetmap.org/way/33704429) | есть | есть | нет | нет | нет | 0.0 |
| 69 | 2952 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2952) | [way/1246282546](https://www.openstreetmap.org/way/1246282546) | есть | есть | нет | нет | нет | 3.4 |
| 70 | 3694 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3694) | [way/1126037593](https://www.openstreetmap.org/way/1126037593) | есть | есть | нет | нет | нет | 0.0 |
| 71 | 4768 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4768) | [way/1315735524](https://www.openstreetmap.org/way/1315735524) | есть | есть | нет | нет | нет | 0.0 |
| 72 | 24687 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24687) | [way/58075177](https://www.openstreetmap.org/way/58075177) | есть | есть | нет | нет | нет | 0.0 |
| 73 | 24686 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24686) | [way/1214399485](https://www.openstreetmap.org/way/1214399485) | есть | есть | есть | есть | есть | 0.0 |
| 74 | 24798 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24798) | [way/706143300](https://www.openstreetmap.org/way/706143300) | есть | есть | нет | нет | нет | 0.3 |
| 75 | 24799 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24799) | [way/607662396](https://www.openstreetmap.org/way/607662396) | есть | есть | нет | нет | нет | 0.0 |
| 76 | 24790 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24790) | [way/367411358](https://www.openstreetmap.org/way/367411358) | есть | есть | нет | нет | нет | 11.7 |
| 77 | 17529 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=17529) | [way/281562097](https://www.openstreetmap.org/way/281562097) | есть | есть | нет | нет | нет | 0.0 |
| 78 | 24759 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24759) | [way/548543650](https://www.openstreetmap.org/way/548543650) | есть | есть | нет | нет | нет | 0.0 |
| 79 | 24777 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24777) | [way/1132673070](https://www.openstreetmap.org/way/1132673070) | есть | есть | нет | нет | нет | 1.8 |
| 80 | 3157 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3157) | [way/1131162702](https://www.openstreetmap.org/way/1131162702) | есть | есть | нет | нет | нет | 5.3 |
| 81 | 24758 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24758) | [way/926722803](https://www.openstreetmap.org/way/926722803) | есть | есть | нет | нет | нет | 0.0 |
| 82 | 17828 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=17828) | [way/217728421](https://www.openstreetmap.org/way/217728421) | есть | нет | нет | нет | нет | 0.0 |
| 83 | 18545 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=18545) | [way/707452284](https://www.openstreetmap.org/way/707452284) | есть | нет | нет | нет | есть | 5.0 |
| 84 | 16008 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16008) | [way/1127985188](https://www.openstreetmap.org/way/1127985188) | есть | нет | нет | нет | нет | 9.7 |
| 85 | 5005 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5005) | [way/92718070](https://www.openstreetmap.org/way/92718070) | есть | нет | нет | нет | нет | 0.0 |
| 86 | 2773 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2773) | [way/246769176](https://www.openstreetmap.org/way/246769176) | есть | нет | нет | нет | нет | 0.0 |
| 87 | 4372 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4372) | [way/1206575056](https://www.openstreetmap.org/way/1206575056) | есть | нет | нет | нет | нет | 0.0 |
| 88 | 17603 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=17603) | [way/281100740](https://www.openstreetmap.org/way/281100740) | есть | нет | нет | нет | нет | 0.0 |
| 89 | 7269 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=7269) | [way/189537334](https://www.openstreetmap.org/way/189537334) | есть | нет | нет | нет | есть | 3.3 |
| 90 | 17876 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=17876) | [way/1155911059](https://www.openstreetmap.org/way/1155911059) | есть | нет | нет | нет | нет | 4.9 |
| 91 | 16984 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16984) | [way/1376864449](https://www.openstreetmap.org/way/1376864449) | есть | нет | нет | нет | нет | 13.2 |
| 92 | 17753 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=17753) | [way/75245232](https://www.openstreetmap.org/way/75245232) | есть | нет | нет | нет | нет | 0.0 |
| 93 | 17183 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=17183) | [way/78067337](https://www.openstreetmap.org/way/78067337) | есть | нет | нет | нет | нет | 0.0 |
| 94 | 24773 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24773) | [way/65619920](https://www.openstreetmap.org/way/65619920) | есть | нет | нет | нет | нет | 0.0 |
| 95 | 23251 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=23251) | [way/137934102](https://www.openstreetmap.org/way/137934102) | есть | нет | нет | нет | нет | 0.0 |
| 96 | 24762 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24762) | [way/75239165](https://www.openstreetmap.org/way/75239165) | есть | нет | нет | нет | есть | 0.0 |
| 97 | 24588 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24588) | [way/370715009](https://www.openstreetmap.org/way/370715009) | есть | нет | есть | нет | есть | 0.0 |
| 98 | 24381 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24381) | [way/1217883905](https://www.openstreetmap.org/way/1217883905) | есть | нет | нет | нет | нет | 0.0 |
| 99 | 24311 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24311) | [way/225453828](https://www.openstreetmap.org/way/225453828) | есть | нет | нет | нет | нет | 0.0 |
| 100 | 24785 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24785) | [way/221432954](https://www.openstreetmap.org/way/221432954) | есть | нет | нет | нет | нет | 0.2 |
| 101 | 24316 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24316) | [way/174304313](https://www.openstreetmap.org/way/174304313) | есть | нет | нет | нет | нет | 0.0 |
| 102 | 24493 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24493) | [way/75257200](https://www.openstreetmap.org/way/75257200) | есть | нет | нет | нет | нет | 1.0 |
| 103 | 5061 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5061) | [way/1341624689](https://www.openstreetmap.org/way/1341624689) | нет | есть | нет | нет | нет | 0.0 |
| 104 | 6659 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=6659) | [way/289192966](https://www.openstreetmap.org/way/289192966) | нет | есть | нет | нет | нет | 11.6 |
| 105 | 8238 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=8238) | [way/1180024165](https://www.openstreetmap.org/way/1180024165) | нет | есть | нет | нет | нет | 0.0 |
| 106 | 16063 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16063) | [way/1236099523](https://www.openstreetmap.org/way/1236099523) | нет | есть | нет | нет | есть | 0.0 |
| 107 | 41529 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41529) | [way/39130616](https://www.openstreetmap.org/way/39130616) | нет | есть | нет | нет | нет | 0.0 |
| 108 | 41531 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41531) | [way/39130640](https://www.openstreetmap.org/way/39130640) | нет | есть | нет | нет | нет | 0.0 |
| 109 | 41534 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41534) | [way/39130639](https://www.openstreetmap.org/way/39130639) | нет | есть | нет | нет | нет | 0.0 |
| 110 | 41539 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41539) | [way/586355175](https://www.openstreetmap.org/way/586355175) | нет | есть | нет | нет | нет | 0.0 |
| 111 | 41556 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41556) | [way/511201675](https://www.openstreetmap.org/way/511201675) | нет | есть | нет | нет | нет | 0.0 |
| 112 | 41580 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41580) | [way/511201688](https://www.openstreetmap.org/way/511201688) | нет | есть | нет | нет | нет | 0.0 |
| 113 | 41571 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41571) | [way/511201680](https://www.openstreetmap.org/way/511201680) | нет | есть | нет | нет | нет | 0.0 |
| 114 | 41540 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41540) | [way/1363653887](https://www.openstreetmap.org/way/1363653887) | нет | есть | нет | нет | нет | 0.0 |
| 115 | 10830 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=10830) | [way/511201683](https://www.openstreetmap.org/way/511201683) | нет | есть | нет | нет | нет | 0.0 |
| 116 | 41550 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41550) | [way/511201665](https://www.openstreetmap.org/way/511201665) | нет | есть | нет | нет | нет | 0.0 |
| 117 | 41587 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41587) | [way/511201677](https://www.openstreetmap.org/way/511201677) | нет | есть | нет | нет | нет | 0.0 |
| 118 | 5064 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5064) | [way/1219359109](https://www.openstreetmap.org/way/1219359109) | нет | есть | нет | нет | нет | 1.8 |
| 119 | 20138 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=20138) | [way/1317985861](https://www.openstreetmap.org/way/1317985861) | нет | есть | нет | нет | нет | 0.0 |
| 120 | 10532 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=10532) | [way/1179812480](https://www.openstreetmap.org/way/1179812480) | нет | есть | нет | нет | нет | 0.0 |
| 121 | 41567 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41567) | [way/511201682](https://www.openstreetmap.org/way/511201682) | нет | есть | нет | нет | нет | 0.0 |
| 122 | 20140 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=20140) | [way/1179709796](https://www.openstreetmap.org/way/1179709796) | нет | есть | нет | нет | нет | 0.0 |
| 123 | 7645 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=7645) | [way/1327536719](https://www.openstreetmap.org/way/1327536719) | нет | есть | нет | нет | нет | 0.0 |
| 124 | 20117 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=20117) | [way/1179426401](https://www.openstreetmap.org/way/1179426401) | нет | есть | нет | нет | нет | 0.0 |
| 125 | 6551 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=6551) | [way/1330237278](https://www.openstreetmap.org/way/1330237278) | нет | есть | нет | нет | нет | 0.3 |
| 126 | 10818 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=10818) | [way/511201684](https://www.openstreetmap.org/way/511201684) | нет | есть | нет | нет | нет | 0.0 |
| 127 | 41546 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41546) | [way/217948134](https://www.openstreetmap.org/way/217948134) | нет | есть | нет | нет | нет | 12.3 |
| 128 | 41570 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41570) | [way/511201679](https://www.openstreetmap.org/way/511201679) | нет | есть | нет | нет | нет | 7.2 |
| 129 | 25048 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=25048) | [way/511328958](https://www.openstreetmap.org/way/511328958) | нет | есть | нет | нет | нет | 0.0 |
| 130 | 17461 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=17461) | [way/511201669](https://www.openstreetmap.org/way/511201669) | нет | есть | нет | нет | нет | 5.3 |
| 131 | 5011 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=5011) | [way/1324230982](https://www.openstreetmap.org/way/1324230982) | нет | есть | нет | нет | нет | 0.0 |
| 132 | 7981 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=7981) | [way/585352693](https://www.openstreetmap.org/way/585352693) | нет | есть | есть | есть | есть | 0.0 |
| 133 | 41568 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41568) | [way/1363568415](https://www.openstreetmap.org/way/1363568415) | нет | есть | нет | нет | нет | 7.6 |
| 134 | 25111 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=25111) | [way/1299930496](https://www.openstreetmap.org/way/1299930496) | нет | есть | есть | нет | есть | 0.0 |
| 135 | 6661 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=6661) | [way/289192952](https://www.openstreetmap.org/way/289192952) | нет | есть | нет | нет | нет | 0.0 |
| 136 | 24776 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24776) | [way/742183462](https://www.openstreetmap.org/way/742183462) | нет | есть | нет | нет | есть | 9.1 |
| 137 | 7659 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=7659) | [way/1327624768](https://www.openstreetmap.org/way/1327624768) | нет | есть | нет | нет | нет | 0.0 |
| 138 | 17902 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=17902) | [way/79398754](https://www.openstreetmap.org/way/79398754) | нет | есть | нет | нет | есть | 3.0 |
| 139 | 26657 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=26657) | [way/555209470](https://www.openstreetmap.org/way/555209470) | нет | есть | нет | нет | нет | 3.4 |
| 140 | 15599 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=15599) | [way/1317986062](https://www.openstreetmap.org/way/1317986062) | нет | есть | нет | нет | нет | 1.1 |
| 141 | 26573 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=26573) | [way/1018836829](https://www.openstreetmap.org/way/1018836829) | нет | есть | нет | нет | есть | 14.7 |
| 142 | 25044 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=25044) | [way/46868441](https://www.openstreetmap.org/way/46868441) | нет | есть | нет | нет | нет | 0.0 |
| 143 | 26684 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=26684) | [way/1317985929](https://www.openstreetmap.org/way/1317985929) | нет | нет | нет | нет | нет | 0.0 |
| 144 | 26796 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=26796) | [way/1321489719](https://www.openstreetmap.org/way/1321489719) | нет | нет | нет | есть | есть | 0.0 |
| 145 | 39414 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=39414) | [way/1547986246](https://www.openstreetmap.org/way/1547986246) | нет | нет | нет | нет | нет | 0.0 |
| 146 | 41537 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41537) | [way/39130623](https://www.openstreetmap.org/way/39130623) | нет | нет | нет | нет | нет | 0.0 |
| 147 | 41543 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41543) | [way/217948136](https://www.openstreetmap.org/way/217948136) | нет | нет | нет | нет | нет | 0.0 |
| 148 | 41552 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41552) | [way/217948133](https://www.openstreetmap.org/way/217948133) | нет | нет | нет | нет | нет | 0.0 |
| 149 | 41561 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41561) | [way/217948137](https://www.openstreetmap.org/way/217948137) | нет | нет | нет | нет | нет | 0.0 |
| 150 | 41557 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41557) | [way/511201674](https://www.openstreetmap.org/way/511201674) | нет | нет | нет | нет | нет | 0.0 |
| 151 | 41554 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41554) | [way/217948139](https://www.openstreetmap.org/way/217948139) | нет | нет | нет | нет | нет | 0.0 |
| 152 | 41528 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41528) | [way/169827471](https://www.openstreetmap.org/way/169827471) | нет | нет | нет | нет | нет | 0.0 |
| 153 | 41535 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41535) | [way/39130620](https://www.openstreetmap.org/way/39130620) | нет | нет | нет | нет | нет | 0.0 |
| 154 | 41586 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41586) | [way/511201676](https://www.openstreetmap.org/way/511201676) | нет | нет | нет | нет | нет | 0.0 |
| 155 | 41575 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41575) | [way/511201687](https://www.openstreetmap.org/way/511201687) | нет | нет | нет | нет | нет | 14.0 |
| 156 | 41560 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41560) | [way/217948135](https://www.openstreetmap.org/way/217948135) | нет | нет | нет | нет | нет | 0.0 |
| 157 | 41576 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41576) | [way/511201692](https://www.openstreetmap.org/way/511201692) | нет | нет | нет | нет | нет | 0.0 |
| 158 | 41583 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41583) | [way/511201686](https://www.openstreetmap.org/way/511201686) | нет | нет | нет | нет | нет | 0.0 |
| 159 | 41545 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41545) | [way/511201673](https://www.openstreetmap.org/way/511201673) | нет | нет | нет | нет | нет | 0.0 |
| 160 | 41592 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41592) | [way/511201691](https://www.openstreetmap.org/way/511201691) | нет | нет | нет | нет | нет | 0.0 |
| 161 | 41536 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41536) | [way/1363653882](https://www.openstreetmap.org/way/1363653882) | нет | нет | нет | нет | нет | 0.0 |
| 162 | 41593 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41593) | [way/511201690](https://www.openstreetmap.org/way/511201690) | нет | нет | нет | нет | нет | 0.0 |
| 163 | 41574 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41574) | [way/511201678](https://www.openstreetmap.org/way/511201678) | нет | нет | нет | нет | нет | 0.0 |
| 164 | 8066 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=8066) | [way/338418435](https://www.openstreetmap.org/way/338418435) | нет | нет | нет | есть | есть | 0.0 |
| 165 | 41558 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41558) | [way/511201672](https://www.openstreetmap.org/way/511201672) | нет | нет | нет | нет | нет | 0.0 |
| 166 | 41548 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41548) | [way/511201671](https://www.openstreetmap.org/way/511201671) | нет | нет | нет | нет | нет | 0.0 |
| 167 | 41578 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41578) | [way/511201689](https://www.openstreetmap.org/way/511201689) | нет | нет | нет | нет | нет | 0.0 |
| 168 | 41541 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41541) | [way/1363653883](https://www.openstreetmap.org/way/1363653883) | нет | нет | нет | нет | нет | 0.0 |
| 169 | 41538 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41538) | [way/1363653884](https://www.openstreetmap.org/way/1363653884) | нет | нет | нет | нет | нет | 0.0 |
| 170 | 41555 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41555) | [way/217948138](https://www.openstreetmap.org/way/217948138) | нет | нет | нет | нет | нет | 0.0 |
| 171 | 41566 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41566) | [way/511201681](https://www.openstreetmap.org/way/511201681) | нет | нет | нет | нет | нет | 0.0 |
| 172 | 7942 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=7942) | [way/78145651](https://www.openstreetmap.org/way/78145651) | нет | нет | нет | нет | есть | 0.7 |
| 173 | 41588 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41588) | [way/1152251974](https://www.openstreetmap.org/way/1152251974) | нет | нет | нет | нет | нет | 0.0 |
| 174 | 41585 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41585) | [way/1516690263](https://www.openstreetmap.org/way/1516690263) | нет | нет | нет | нет | нет | 0.0 |
| 175 | 41527 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41527) | [way/511201694](https://www.openstreetmap.org/way/511201694) | нет | нет | нет | нет | нет | 0.0 |
| 176 | 24678 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24678) | [way/58756687](https://www.openstreetmap.org/way/58756687) | нет | нет | нет | нет | нет | 2.6 |
| 177 | 7046 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=7046) | [way/1327624702](https://www.openstreetmap.org/way/1327624702) | нет | нет | нет | нет | нет | 0.8 |
| 178 | 16980 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16980) | [way/531596102](https://www.openstreetmap.org/way/531596102) | нет | нет | нет | нет | нет | 0.0 |
| 179 | 6506 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=6506) | [way/1064270005](https://www.openstreetmap.org/way/1064270005) | нет | нет | нет | нет | нет | 0.0 |
| 180 | 24367 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24367) | [way/73492672](https://www.openstreetmap.org/way/73492672) | нет | нет | нет | нет | нет | 0.0 |
| 181 | 24394 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24394) | [way/688744507](https://www.openstreetmap.org/way/688744507) | нет | нет | нет | нет | нет | 0.0 |
| 182 | 26800 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=26800) | [way/1321679167](https://www.openstreetmap.org/way/1321679167) | нет | нет | нет | нет | нет | 0.0 |
| 183 | 41595 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=41595) | [way/1516690264](https://www.openstreetmap.org/way/1516690264) | нет | нет | нет | нет | нет | 9.1 |
| 184 | 23232 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=23232) | [way/137934259](https://www.openstreetmap.org/way/137934259) | нет | нет | нет | нет | нет | 0.0 |
| 185 | 15663 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=15663) | [way/289192932](https://www.openstreetmap.org/way/289192932) | нет | нет | нет | нет | нет | 0.2 |
| 186 | 24368 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=24368) | [way/1330015161](https://www.openstreetmap.org/way/1330015161) | нет | нет | нет | нет | нет | 1.2 |
| 187 | 20141 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=20141) | [way/1179709816](https://www.openstreetmap.org/way/1179709816) | нет | нет | нет | нет | нет | 0.0 |
| 188 | 15633 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=15633) | [way/1097671989](https://www.openstreetmap.org/way/1097671989) | нет | нет | нет | нет | нет | 16.1 |
| 189 | 15634 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=15634) | [way/1098255091](https://www.openstreetmap.org/way/1098255091) | нет | нет | нет | нет | нет | 6.9 |
| 190 | 2673 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2673) | [way/1225299267](https://www.openstreetmap.org/way/1225299267) | есть | есть | нет | нет | нет | 0.0 |
| 191 | 2681 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2681) | [way/1225073810](https://www.openstreetmap.org/way/1225073810) | есть | есть | нет | нет | нет | 0.0 |
| 192 | 2682 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2682) | [way/1278166570](https://www.openstreetmap.org/way/1278166570) | есть | есть | нет | нет | нет | 12.1 |
| 193 | 2686 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2686) | [way/246784632](https://www.openstreetmap.org/way/246784632) | есть | есть | нет | нет | нет | 0.0 |
| 194 | 2693 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2693) | [way/1350342951](https://www.openstreetmap.org/way/1350342951) | есть | есть | нет | нет | нет | 0.0 |
| 195 | 2696 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2696) | [way/1350086113](https://www.openstreetmap.org/way/1350086113) | есть | есть | нет | нет | нет | 10.2 |
| 196 | 2698 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2698) | [way/1225051115](https://www.openstreetmap.org/way/1225051115) | есть | есть | нет | нет | нет | 0.0 |
| 197 | 2699 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2699) | [way/246851231](https://www.openstreetmap.org/way/246851231) | есть | есть | нет | нет | нет | 0.0 |
| 198 | 2702 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2702) | [way/337253401](https://www.openstreetmap.org/way/337253401) | есть | есть | нет | нет | нет | 0.0 |
| 199 | 2703 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2703) | [way/1225051118](https://www.openstreetmap.org/way/1225051118) | есть | есть | нет | нет | нет | 0.0 |
| 200 | 2704 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2704) | [way/1365781996](https://www.openstreetmap.org/way/1365781996) | есть | есть | нет | нет | нет | 0.0 |

## Состояние подготовки

- Детерминированные факты собраны по всем 200 кандидатам: `work/queue-v2/index.jsonl`, 200/200 без ошибок (локальный кэш, в git не входит).
- IoU с реестровой границей: ≥0,70 — 68; 0,25–0,70 — 53; <0,25 — 79. Низкий IoU — сигнал для ручной проверки пары «реестр — OSM», а не готовый вердикт.
- Google Place ID, фотографии и карточки не готовились: это следующий этап, после проверки идентичности.

## Ограничения перед добавлением в каталог

- Это первичная очередь из реестра охраняемого наследия, а не редакционное решение о публикации. Отсеять не отдельные здания, дубли комплексов, разрушенные/перестроенные объекты и неуместные для атласа записи.
- Найденные OSM-контуры локальны и имеют лицензию ODbL; перед включением подтвердить геометрию, закрытые кольца и соответствие конкретному корпусу. Не использовать точку реестра как геометрию.
- Сначала проверить исторические факты по первичному источнику, отдельно отличая датировку существующего корпуса от периода участка/комплекса.
- У каждого снимка проверить здание, ракурс, авторство, лицензию и отдельные права на архитектурное произведение.
- Place ID необязателен для исторической карточки; Google API запускать только отдельным согласованным батчем с допуском 5 м.

Генератор: `python3 scripts/create-next-200-report.py --output docs/research-next-200-v2.md --exclude-queue docs/research-next-200.md --label "следующие 200 объектов Тбилиси (вторая очередь)"`. Флаг `--exclude-queue` исключает записи предыдущей очереди по ID реестра и OSM way; для перезаписи существующего отчёта нужен `--force`. Данные реестра запрашиваются по HTTPS с проверкой сертификата.
