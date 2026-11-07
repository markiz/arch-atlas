# Исследовательская очередь: следующие 200 объектов Тбилиси (третья очередь)

**Статус:** очередь разобрана 1 ноября 2026 года: 55 карточек добавлено, 116 hold, 29 reject. Итоги — в [research-queue-v3.md](research-queue-v3.md).

Предыдущая очередь: [research-next-200-v2.md](../queue-2-heritage-200/research-next-200-v2.md), её итоги — в [research-queue-v2.md](../queue-2-heritage-200/research-queue-v2.md). Эта очередь только подготовлена: карточек из неё ещё нет, факты не проверялись.

**Снимок:** 2026-10-31 UTC. Контуры: © участники OpenStreetMap, [ODbL](https://www.openstreetmap.org/copyright).

## Основание и метод

- В официальном реестре найдено записей по Тбилиси: **2599**. Запрос: `Region=N'თბილისი'` к [слою недвижимых памятников](https://memkvidreoba.gov.ge/arcgisch/rest/services/CultureWMS/PS_ImmovableMonumentObjectP/MapServer/1).
- Сопоставление выполнено с 121,313 контурами из локальной OSM-выгрузки `raw/osm-tbilisi-building-outlines.geojson` и 212 карточками атласа на момент отбора.
- Отобраны записи с классификацией архитектуры, отдельным контуром OSM в радиусе примерно 17 м, без близкого совпадения или значительного пересечения с текущей карточкой атласа. Сначала взяты записи с конкретным названием и содержательным описанием.
- Исключены все записи предыдущих очередей: `docs/research-next-200.md`, `docs/research-next-200-v2.md`. Дополнительно отсечены этнографические и садово-парковые классификации и объекты дальше 8 км от центра.
- После двух очередей именованных городских объектов в реестре почти не осталось: большинство строк — безымянные исторические жилые дома. Они включены как кандидаты, но при разборе действует строгое правило: рядовой дом без подтверждённой архитектурной ценности не добавляется.
- Сопоставление точки реестра с контуром автоматическое. Даже расстояние 0 м не подтверждает, что реестр и контур относятся к одному корпусу; каждую пару нужно проверить на карте и по адресу.
- Официальные текстовые поля не перепечатываются в этом отчёте: условия повторного использования данных реестра не установлены. Идентификаторы нужны для открытия карточек источника.

## Сводка пробелов для отобранных 200

| Поле / проверка | Не хватает или нужно проверить | Что известно сейчас |
|---|---:|---|
| Адрес в реестре | 0/200 без адреса | Наличие поля не заменяет проверку адреса и перевод на русский, английский и украинский |
| Датировка в реестре | 0/200 без `ExactDate`; 172/200 без четырёхзначного года в строке | Год в строке также требует проверки: он может относиться к перестройке или диапазону |
| Описание в реестре | 0/200 без описания | Тексты источника на грузинском требуют редакционной выжимки и перевода |
| Номер реестра | 10/200 без `RegistryN` | `ObjectID` и ссылка на источник остаются доступны |
| Архитектор | 195/200 без тега архитектора в сопоставленном OSM-контуре | Отдельного поля архитектора в схеме реестра нет; нужна профильная проверка |
| Стиль | 197/200 без `building:architecture` в OSM | У реестра нет отдельного поля стиля; классифицировать по источнику/фасаду |
| Фото | 198/200 без тега `wikimedia_commons` у контура | Проверенной локальной галереи с автором, лицензией и правами пока нет |
| Геометрия | 0/200 без близкого контура OSM; 13/200 точек реестра дальше 5 м от сопоставленного контура | Все пары требуют ручного подтверждения принадлежности корпуса и качества Polygon |
| Переводы и карточка атласа | 200/200 | Нужны переводы имени, адреса и описания на ru/en/ka/uk, район, стиль/авторы с ID и редакционный текст |

## Список для ручной проверки

Таблица не содержит названий и адресов из реестра. Откройте карточку источника по ссылке; OSM way — только пространственный кандидат.

| № | ID реестра | Реестр | OSM way-кандидат | Адрес в источнике | Дата в источнике | Архитектор в OSM | Стиль в OSM | Commons-ссылка | Смещение точки, м |
|---:|---:|---|---|---|---|---|---|---|---:|
| 1 | 2710 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2710) | [way/1227025957](https://www.openstreetmap.org/way/1227025957) | есть | есть | нет | нет | нет | 0.6 |
| 2 | 2712 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2712) | [way/1069053611](https://www.openstreetmap.org/way/1069053611) | есть | есть | нет | нет | нет | 0.0 |
| 3 | 2716 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2716) | [way/1225299312](https://www.openstreetmap.org/way/1225299312) | есть | есть | нет | нет | нет | 2.0 |
| 4 | 2717 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2717) | [way/1267989272](https://www.openstreetmap.org/way/1267989272) | есть | есть | нет | нет | нет | 0.0 |
| 5 | 2718 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2718) | [way/246757159](https://www.openstreetmap.org/way/246757159) | есть | есть | нет | нет | нет | 0.0 |
| 6 | 2720 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2720) | [way/1225073814](https://www.openstreetmap.org/way/1225073814) | есть | есть | нет | нет | нет | 0.0 |
| 7 | 2723 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2723) | [way/1158550269](https://www.openstreetmap.org/way/1158550269) | есть | есть | нет | нет | нет | 0.0 |
| 8 | 2726 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2726) | [way/1350342965](https://www.openstreetmap.org/way/1350342965) | есть | есть | нет | нет | нет | 0.0 |
| 9 | 2727 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2727) | [way/246787222](https://www.openstreetmap.org/way/246787222) | есть | есть | нет | нет | нет | 0.0 |
| 10 | 2729 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2729) | [way/246783239](https://www.openstreetmap.org/way/246783239) | есть | есть | нет | нет | нет | 0.0 |
| 11 | 2732 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2732) | [way/686739858](https://www.openstreetmap.org/way/686739858) | есть | есть | нет | нет | нет | 0.0 |
| 12 | 2734 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2734) | [way/337373602](https://www.openstreetmap.org/way/337373602) | есть | есть | нет | нет | нет | 0.0 |
| 13 | 2738 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2738) | [way/1350086111](https://www.openstreetmap.org/way/1350086111) | есть | есть | нет | нет | нет | 0.0 |
| 14 | 2740 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2740) | [way/1069053612](https://www.openstreetmap.org/way/1069053612) | есть | есть | нет | нет | нет | 0.0 |
| 15 | 2747 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2747) | [way/1158550272](https://www.openstreetmap.org/way/1158550272) | есть | есть | нет | нет | нет | 0.0 |
| 16 | 2751 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2751) | [way/1256991527](https://www.openstreetmap.org/way/1256991527) | есть | есть | нет | нет | нет | 1.5 |
| 17 | 2754 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2754) | [way/1350751300](https://www.openstreetmap.org/way/1350751300) | есть | есть | нет | нет | нет | 0.0 |
| 18 | 2758 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2758) | [way/1054643964](https://www.openstreetmap.org/way/1054643964) | есть | есть | нет | нет | нет | 0.0 |
| 19 | 2760 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2760) | [way/1225051117](https://www.openstreetmap.org/way/1225051117) | есть | есть | нет | нет | нет | 0.0 |
| 20 | 2761 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2761) | [way/246785821](https://www.openstreetmap.org/way/246785821) | есть | есть | нет | нет | нет | 0.0 |
| 21 | 2762 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2762) | [way/1227025959](https://www.openstreetmap.org/way/1227025959) | есть | есть | нет | нет | нет | 0.0 |
| 22 | 2767 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2767) | [way/1158549470](https://www.openstreetmap.org/way/1158549470) | есть | есть | нет | нет | нет | 0.0 |
| 23 | 2768 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2768) | [way/1158550266](https://www.openstreetmap.org/way/1158550266) | есть | есть | нет | нет | нет | 0.0 |
| 24 | 2770 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2770) | [way/246782507](https://www.openstreetmap.org/way/246782507) | есть | есть | нет | нет | нет | 0.0 |
| 25 | 2774 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2774) | [way/246757386](https://www.openstreetmap.org/way/246757386) | есть | есть | нет | нет | нет | 0.0 |
| 26 | 2776 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2776) | [way/337371713](https://www.openstreetmap.org/way/337371713) | есть | есть | нет | нет | нет | 0.0 |
| 27 | 2782 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2782) | [way/1267989274](https://www.openstreetmap.org/way/1267989274) | есть | есть | нет | нет | нет | 0.0 |
| 28 | 2783 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2783) | [way/1225051124](https://www.openstreetmap.org/way/1225051124) | есть | есть | нет | нет | нет | 0.0 |
| 29 | 2790 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2790) | [way/1350751277](https://www.openstreetmap.org/way/1350751277) | есть | есть | нет | нет | нет | 0.0 |
| 30 | 2791 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2791) | [way/337371256](https://www.openstreetmap.org/way/337371256) | есть | есть | нет | нет | нет | 0.0 |
| 31 | 2794 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2794) | [way/1158550277](https://www.openstreetmap.org/way/1158550277) | есть | есть | нет | нет | нет | 0.0 |
| 32 | 2796 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2796) | [way/1225073825](https://www.openstreetmap.org/way/1225073825) | есть | есть | нет | нет | нет | 0.0 |
| 33 | 2800 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2800) | [way/707951859](https://www.openstreetmap.org/way/707951859) | есть | есть | нет | нет | нет | 0.0 |
| 34 | 2806 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2806) | [way/246785822](https://www.openstreetmap.org/way/246785822) | есть | есть | нет | нет | нет | 0.0 |
| 35 | 2815 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2815) | [way/776694012](https://www.openstreetmap.org/way/776694012) | есть | есть | нет | нет | нет | 0.0 |
| 36 | 2818 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2818) | [way/804970320](https://www.openstreetmap.org/way/804970320) | есть | есть | нет | нет | нет | 2.0 |
| 37 | 2820 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2820) | [way/337253398](https://www.openstreetmap.org/way/337253398) | есть | есть | нет | нет | нет | 0.0 |
| 38 | 2822 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2822) | [way/1350086110](https://www.openstreetmap.org/way/1350086110) | есть | есть | нет | нет | нет | 0.0 |
| 39 | 2824 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2824) | [way/246770164](https://www.openstreetmap.org/way/246770164) | есть | есть | нет | нет | нет | 2.1 |
| 40 | 2832 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2832) | [way/1225299256](https://www.openstreetmap.org/way/1225299256) | есть | есть | нет | нет | нет | 0.0 |
| 41 | 2833 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2833) | [way/246757150](https://www.openstreetmap.org/way/246757150) | есть | есть | нет | нет | нет | 0.0 |
| 42 | 2834 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2834) | [way/1312915827](https://www.openstreetmap.org/way/1312915827) | есть | есть | нет | нет | нет | 0.0 |
| 43 | 2836 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2836) | [way/337253399](https://www.openstreetmap.org/way/337253399) | есть | есть | нет | нет | нет | 0.0 |
| 44 | 2837 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2837) | [way/1225051119](https://www.openstreetmap.org/way/1225051119) | есть | есть | нет | нет | нет | 0.0 |
| 45 | 2842 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2842) | [way/1350751268](https://www.openstreetmap.org/way/1350751268) | есть | есть | нет | нет | нет | 0.0 |
| 46 | 2845 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2845) | [way/1060291049](https://www.openstreetmap.org/way/1060291049) | есть | есть | нет | нет | нет | 0.0 |
| 47 | 2854 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2854) | [way/1350751319](https://www.openstreetmap.org/way/1350751319) | есть | есть | нет | нет | нет | 0.0 |
| 48 | 2856 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2856) | [way/1225051116](https://www.openstreetmap.org/way/1225051116) | есть | есть | нет | нет | нет | 0.0 |
| 49 | 2860 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2860) | [way/565040613](https://www.openstreetmap.org/way/565040613) | есть | есть | нет | нет | нет | 0.0 |
| 50 | 2861 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2861) | [way/337371257](https://www.openstreetmap.org/way/337371257) | есть | есть | нет | нет | нет | 0.0 |
| 51 | 2862 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2862) | [way/686739857](https://www.openstreetmap.org/way/686739857) | есть | есть | нет | нет | нет | 0.0 |
| 52 | 2863 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2863) | [way/337371716](https://www.openstreetmap.org/way/337371716) | есть | есть | нет | нет | нет | 0.0 |
| 53 | 2866 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2866) | [way/246768641](https://www.openstreetmap.org/way/246768641) | есть | есть | нет | нет | нет | 0.0 |
| 54 | 2867 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2867) | [way/1289207839](https://www.openstreetmap.org/way/1289207839) | есть | есть | нет | нет | нет | 0.0 |
| 55 | 2870 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2870) | [way/1267989271](https://www.openstreetmap.org/way/1267989271) | есть | есть | нет | нет | нет | 7.2 |
| 56 | 2878 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2878) | [way/1225299310](https://www.openstreetmap.org/way/1225299310) | есть | есть | нет | нет | нет | 0.0 |
| 57 | 2881 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2881) | [way/1227026013](https://www.openstreetmap.org/way/1227026013) | есть | есть | нет | нет | нет | 0.0 |
| 58 | 2883 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2883) | [way/1288791356](https://www.openstreetmap.org/way/1288791356) | есть | есть | нет | нет | нет | 15.2 |
| 59 | 2885 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2885) | [way/1278166561](https://www.openstreetmap.org/way/1278166561) | есть | есть | нет | нет | нет | 0.0 |
| 60 | 2887 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2887) | [way/804970321](https://www.openstreetmap.org/way/804970321) | есть | есть | нет | нет | нет | 2.1 |
| 61 | 2889 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2889) | [way/1227025964](https://www.openstreetmap.org/way/1227025964) | есть | есть | нет | нет | нет | 1.7 |
| 62 | 2893 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2893) | [way/1288791330](https://www.openstreetmap.org/way/1288791330) | есть | есть | нет | нет | нет | 0.0 |
| 63 | 2900 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2900) | [way/1289207820](https://www.openstreetmap.org/way/1289207820) | есть | есть | нет | нет | нет | 0.0 |
| 64 | 2901 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2901) | [way/1288791331](https://www.openstreetmap.org/way/1288791331) | есть | есть | нет | нет | нет | 0.0 |
| 65 | 2904 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2904) | [way/367443296](https://www.openstreetmap.org/way/367443296) | есть | есть | нет | нет | нет | 0.0 |
| 66 | 2910 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2910) | [way/1225051084](https://www.openstreetmap.org/way/1225051084) | есть | есть | нет | нет | нет | 0.0 |
| 67 | 2913 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2913) | [way/1157284977](https://www.openstreetmap.org/way/1157284977) | есть | есть | нет | нет | нет | 2.7 |
| 68 | 2915 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2915) | [way/337371714](https://www.openstreetmap.org/way/337371714) | есть | есть | нет | нет | нет | 1.0 |
| 69 | 2916 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2916) | [way/1225051125](https://www.openstreetmap.org/way/1225051125) | есть | есть | нет | нет | нет | 0.0 |
| 70 | 2917 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2917) | [way/1225051095](https://www.openstreetmap.org/way/1225051095) | есть | есть | нет | нет | нет | 0.0 |
| 71 | 2919 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2919) | [way/246770155](https://www.openstreetmap.org/way/246770155) | есть | есть | нет | нет | нет | 0.0 |
| 72 | 2920 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2920) | [way/538573153](https://www.openstreetmap.org/way/538573153) | есть | есть | нет | нет | нет | 9.1 |
| 73 | 2921 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2921) | [way/246754367](https://www.openstreetmap.org/way/246754367) | есть | есть | нет | нет | нет | 0.0 |
| 74 | 2922 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2922) | [way/1131162717](https://www.openstreetmap.org/way/1131162717) | есть | есть | нет | нет | нет | 0.0 |
| 75 | 2924 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2924) | [way/246782497](https://www.openstreetmap.org/way/246782497) | есть | есть | нет | нет | нет | 1.1 |
| 76 | 2927 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2927) | [way/220706191](https://www.openstreetmap.org/way/220706191) | есть | есть | нет | нет | нет | 0.0 |
| 77 | 2931 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2931) | [way/337253402](https://www.openstreetmap.org/way/337253402) | есть | есть | нет | нет | нет | 0.0 |
| 78 | 2933 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2933) | [way/516894702](https://www.openstreetmap.org/way/516894702) | есть | есть | нет | нет | нет | 0.0 |
| 79 | 2937 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2937) | [way/1127960831](https://www.openstreetmap.org/way/1127960831) | есть | есть | нет | нет | нет | 0.4 |
| 80 | 2938 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2938) | [way/220704997](https://www.openstreetmap.org/way/220704997) | есть | есть | нет | нет | нет | 2.4 |
| 81 | 2940 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2940) | [way/1289207869](https://www.openstreetmap.org/way/1289207869) | есть | есть | нет | нет | нет | 0.6 |
| 82 | 2942 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2942) | [way/1288791329](https://www.openstreetmap.org/way/1288791329) | есть | есть | нет | нет | нет | 0.0 |
| 83 | 2946 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2946) | [way/246787144](https://www.openstreetmap.org/way/246787144) | есть | есть | нет | нет | нет | 0.0 |
| 84 | 2948 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2948) | [way/246787216](https://www.openstreetmap.org/way/246787216) | есть | есть | нет | нет | нет | 0.0 |
| 85 | 2950 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2950) | [way/1289207811](https://www.openstreetmap.org/way/1289207811) | есть | есть | нет | нет | нет | 0.0 |
| 86 | 2953 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2953) | [way/337542609](https://www.openstreetmap.org/way/337542609) | есть | есть | нет | нет | нет | 0.0 |
| 87 | 2958 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2958) | [way/246754287](https://www.openstreetmap.org/way/246754287) | есть | есть | нет | нет | нет | 16.7 |
| 88 | 2963 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2963) | [way/406752353](https://www.openstreetmap.org/way/406752353) | есть | есть | есть | нет | нет | 0.0 |
| 89 | 2966 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2966) | [way/538573159](https://www.openstreetmap.org/way/538573159) | есть | есть | нет | нет | нет | 11.7 |
| 90 | 2967 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2967) | [way/1225299253](https://www.openstreetmap.org/way/1225299253) | есть | есть | нет | нет | нет | 5.5 |
| 91 | 2973 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2973) | [way/1169864232](https://www.openstreetmap.org/way/1169864232) | есть | есть | нет | нет | нет | 0.0 |
| 92 | 2975 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2975) | [way/686739856](https://www.openstreetmap.org/way/686739856) | есть | есть | нет | нет | нет | 0.0 |
| 93 | 2976 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2976) | [way/1169864233](https://www.openstreetmap.org/way/1169864233) | есть | есть | нет | нет | нет | 0.0 |
| 94 | 2978 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2978) | [way/246770170](https://www.openstreetmap.org/way/246770170) | есть | есть | нет | нет | нет | 0.0 |
| 95 | 2981 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2981) | [way/337371712](https://www.openstreetmap.org/way/337371712) | есть | есть | нет | нет | нет | 0.0 |
| 96 | 2985 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2985) | [way/246754368](https://www.openstreetmap.org/way/246754368) | есть | есть | нет | нет | нет | 0.0 |
| 97 | 2988 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2988) | [way/217728725](https://www.openstreetmap.org/way/217728725) | есть | есть | нет | нет | нет | 0.0 |
| 98 | 2992 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2992) | [way/1060291048](https://www.openstreetmap.org/way/1060291048) | есть | есть | нет | есть | нет | 0.0 |
| 99 | 2995 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2995) | [way/1225299296](https://www.openstreetmap.org/way/1225299296) | есть | есть | нет | нет | нет | 0.0 |
| 100 | 2997 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2997) | [way/1289207816](https://www.openstreetmap.org/way/1289207816) | есть | есть | нет | нет | нет | 0.0 |
| 101 | 3002 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3002) | [way/1225299281](https://www.openstreetmap.org/way/1225299281) | есть | есть | нет | нет | нет | 0.0 |
| 102 | 3003 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3003) | [way/1365593644](https://www.openstreetmap.org/way/1365593644) | есть | есть | нет | нет | нет | 0.0 |
| 103 | 3006 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3006) | [way/246783289](https://www.openstreetmap.org/way/246783289) | есть | есть | нет | нет | нет | 0.0 |
| 104 | 3008 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3008) | [way/411566025](https://www.openstreetmap.org/way/411566025) | есть | есть | есть | нет | нет | 0.0 |
| 105 | 3009 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3009) | [way/1069053614](https://www.openstreetmap.org/way/1069053614) | есть | есть | нет | нет | нет | 0.0 |
| 106 | 3013 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3013) | [way/1278166605](https://www.openstreetmap.org/way/1278166605) | есть | есть | нет | нет | нет | 0.0 |
| 107 | 3014 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3014) | [way/1278166587](https://www.openstreetmap.org/way/1278166587) | есть | есть | нет | нет | нет | 0.0 |
| 108 | 3017 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3017) | [way/1069051166](https://www.openstreetmap.org/way/1069051166) | есть | есть | нет | нет | нет | 0.0 |
| 109 | 3018 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3018) | [way/78343133](https://www.openstreetmap.org/way/78343133) | есть | есть | нет | нет | нет | 0.0 |
| 110 | 3020 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3020) | [way/336997947](https://www.openstreetmap.org/way/336997947) | есть | есть | нет | нет | нет | 0.0 |
| 111 | 3021 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3021) | [way/246782509](https://www.openstreetmap.org/way/246782509) | есть | есть | нет | нет | нет | 0.0 |
| 112 | 3024 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3024) | [way/538573180](https://www.openstreetmap.org/way/538573180) | есть | есть | нет | нет | нет | 0.0 |
| 113 | 3027 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3027) | [way/1054663908](https://www.openstreetmap.org/way/1054663908) | есть | есть | нет | нет | нет | 15.2 |
| 114 | 3029 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3029) | [way/337420881](https://www.openstreetmap.org/way/337420881) | есть | есть | нет | нет | нет | 0.0 |
| 115 | 3031 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3031) | [way/1169859490](https://www.openstreetmap.org/way/1169859490) | есть | есть | нет | нет | нет | 13.9 |
| 116 | 3033 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3033) | [way/1069051176](https://www.openstreetmap.org/way/1069051176) | есть | есть | нет | нет | нет | 0.0 |
| 117 | 3034 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3034) | [way/1060290495](https://www.openstreetmap.org/way/1060290495) | есть | есть | нет | нет | нет | 0.2 |
| 118 | 3037 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3037) | [way/1278166603](https://www.openstreetmap.org/way/1278166603) | есть | есть | нет | нет | нет | 1.5 |
| 119 | 3038 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3038) | [way/464257619](https://www.openstreetmap.org/way/464257619) | есть | есть | нет | нет | нет | 0.0 |
| 120 | 3039 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3039) | [way/1060290488](https://www.openstreetmap.org/way/1060290488) | есть | есть | нет | нет | нет | 0.0 |
| 121 | 3042 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3042) | [way/275895743](https://www.openstreetmap.org/way/275895743) | есть | есть | нет | нет | нет | 0.0 |
| 122 | 3043 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3043) | [way/337440354](https://www.openstreetmap.org/way/337440354) | есть | есть | нет | нет | нет | 4.8 |
| 123 | 3051 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3051) | [way/1288791454](https://www.openstreetmap.org/way/1288791454) | есть | есть | нет | нет | нет | 0.0 |
| 124 | 3052 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3052) | [way/337373513](https://www.openstreetmap.org/way/337373513) | есть | есть | нет | нет | нет | 0.0 |
| 125 | 3054 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3054) | [way/246782520](https://www.openstreetmap.org/way/246782520) | есть | есть | нет | нет | нет | 0.0 |
| 126 | 3061 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3061) | [way/1131162692](https://www.openstreetmap.org/way/1131162692) | есть | есть | нет | нет | нет | 1.0 |
| 127 | 3062 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3062) | [way/1289207866](https://www.openstreetmap.org/way/1289207866) | есть | есть | нет | нет | нет | 0.0 |
| 128 | 3065 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3065) | [way/246769271](https://www.openstreetmap.org/way/246769271) | есть | есть | нет | нет | нет | 0.0 |
| 129 | 3066 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3066) | [way/1289207862](https://www.openstreetmap.org/way/1289207862) | есть | есть | нет | нет | нет | 0.0 |
| 130 | 3067 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3067) | [way/1226324505](https://www.openstreetmap.org/way/1226324505) | есть | есть | нет | нет | нет | 9.2 |
| 131 | 3068 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3068) | [way/246770156](https://www.openstreetmap.org/way/246770156) | есть | есть | нет | нет | нет | 0.0 |
| 132 | 3070 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3070) | [way/1288791364](https://www.openstreetmap.org/way/1288791364) | есть | есть | нет | нет | нет | 3.6 |
| 133 | 3073 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3073) | [way/1365593643](https://www.openstreetmap.org/way/1365593643) | есть | есть | нет | нет | нет | 0.0 |
| 134 | 3074 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3074) | [way/1288791436](https://www.openstreetmap.org/way/1288791436) | есть | есть | нет | нет | нет | 0.0 |
| 135 | 3075 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3075) | [way/464256511](https://www.openstreetmap.org/way/464256511) | есть | есть | нет | нет | нет | 0.0 |
| 136 | 3076 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3076) | [way/132311403](https://www.openstreetmap.org/way/132311403) | есть | есть | нет | нет | нет | 0.0 |
| 137 | 3079 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3079) | [way/1131162733](https://www.openstreetmap.org/way/1131162733) | есть | есть | нет | нет | нет | 0.0 |
| 138 | 3080 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3080) | [way/246783257](https://www.openstreetmap.org/way/246783257) | есть | есть | нет | нет | нет | 2.2 |
| 139 | 3081 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3081) | [way/1225299252](https://www.openstreetmap.org/way/1225299252) | есть | есть | нет | нет | нет | 0.0 |
| 140 | 3083 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3083) | [way/1365748457](https://www.openstreetmap.org/way/1365748457) | есть | есть | нет | нет | нет | 10.7 |
| 141 | 3086 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3086) | [way/367443302](https://www.openstreetmap.org/way/367443302) | есть | есть | нет | нет | нет | 0.0 |
| 142 | 3088 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3088) | [way/1283023030](https://www.openstreetmap.org/way/1283023030) | есть | есть | нет | нет | нет | 0.0 |
| 143 | 3089 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3089) | [way/421427883](https://www.openstreetmap.org/way/421427883) | есть | есть | нет | нет | нет | 16.5 |
| 144 | 3090 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3090) | [way/414653510](https://www.openstreetmap.org/way/414653510) | есть | есть | нет | нет | нет | 0.0 |
| 145 | 3095 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3095) | [way/464256514](https://www.openstreetmap.org/way/464256514) | есть | есть | нет | нет | нет | 0.0 |
| 146 | 3096 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3096) | [way/1069051172](https://www.openstreetmap.org/way/1069051172) | есть | есть | нет | нет | нет | 0.0 |
| 147 | 3098 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3098) | [way/1009586567](https://www.openstreetmap.org/way/1009586567) | есть | есть | нет | нет | нет | 10.6 |
| 148 | 3102 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3102) | [way/246787210](https://www.openstreetmap.org/way/246787210) | есть | есть | нет | нет | нет | 0.0 |
| 149 | 3104 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3104) | [way/1127960814](https://www.openstreetmap.org/way/1127960814) | есть | есть | нет | нет | нет | 0.0 |
| 150 | 3105 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3105) | [way/462897305](https://www.openstreetmap.org/way/462897305) | есть | есть | есть | есть | есть | 0.0 |
| 151 | 3107 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3107) | [way/1131162712](https://www.openstreetmap.org/way/1131162712) | есть | есть | нет | нет | нет | 2.6 |
| 152 | 3109 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3109) | [way/417136682](https://www.openstreetmap.org/way/417136682) | есть | есть | нет | нет | нет | 0.0 |
| 153 | 3110 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3110) | [way/416304834](https://www.openstreetmap.org/way/416304834) | есть | есть | нет | нет | нет | 12.3 |
| 154 | 3112 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3112) | [way/416306402](https://www.openstreetmap.org/way/416306402) | есть | есть | нет | нет | нет | 0.0 |
| 155 | 3114 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3114) | [way/157226726](https://www.openstreetmap.org/way/157226726) | есть | есть | нет | нет | нет | 0.0 |
| 156 | 3116 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3116) | [way/1279183703](https://www.openstreetmap.org/way/1279183703) | есть | есть | нет | нет | нет | 0.0 |
| 157 | 3121 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3121) | [way/1013496106](https://www.openstreetmap.org/way/1013496106) | есть | есть | нет | нет | нет | 0.0 |
| 158 | 3129 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3129) | [way/1365763178](https://www.openstreetmap.org/way/1365763178) | есть | есть | нет | нет | нет | 0.0 |
| 159 | 3131 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3131) | [way/565040603](https://www.openstreetmap.org/way/565040603) | есть | есть | нет | нет | нет | 0.0 |
| 160 | 3136 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3136) | [way/1113609522](https://www.openstreetmap.org/way/1113609522) | есть | есть | нет | нет | нет | 0.0 |
| 161 | 3138 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3138) | [way/1289207867](https://www.openstreetmap.org/way/1289207867) | есть | есть | нет | нет | нет | 0.0 |
| 162 | 3139 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3139) | [way/282713335](https://www.openstreetmap.org/way/282713335) | есть | есть | нет | нет | нет | 0.0 |
| 163 | 3140 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3140) | [way/56696105](https://www.openstreetmap.org/way/56696105) | есть | есть | нет | есть | есть | 0.0 |
| 164 | 3142 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3142) | [way/417691872](https://www.openstreetmap.org/way/417691872) | есть | есть | нет | нет | нет | 0.0 |
| 165 | 3143 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3143) | [way/1069051169](https://www.openstreetmap.org/way/1069051169) | есть | есть | нет | нет | нет | 0.0 |
| 166 | 3148 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3148) | [way/1365376963](https://www.openstreetmap.org/way/1365376963) | есть | есть | нет | нет | нет | 0.0 |
| 167 | 3149 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3149) | [way/1069051170](https://www.openstreetmap.org/way/1069051170) | есть | есть | нет | нет | нет | 0.0 |
| 168 | 3152 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3152) | [way/416306403](https://www.openstreetmap.org/way/416306403) | есть | есть | нет | нет | нет | 0.0 |
| 169 | 3154 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3154) | [way/282461575](https://www.openstreetmap.org/way/282461575) | есть | есть | нет | нет | нет | 0.0 |
| 170 | 3159 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3159) | [way/246780472](https://www.openstreetmap.org/way/246780472) | есть | есть | нет | нет | нет | 0.0 |
| 171 | 3168 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3168) | [way/416304837](https://www.openstreetmap.org/way/416304837) | есть | есть | нет | нет | нет | 0.5 |
| 172 | 3171 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3171) | [way/417136678](https://www.openstreetmap.org/way/417136678) | есть | есть | нет | нет | нет | 0.0 |
| 173 | 3176 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3176) | [way/285012750](https://www.openstreetmap.org/way/285012750) | есть | есть | нет | нет | нет | 0.0 |
| 174 | 3180 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3180) | [way/416305165](https://www.openstreetmap.org/way/416305165) | есть | есть | нет | нет | нет | 0.0 |
| 175 | 3181 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3181) | [way/1069051171](https://www.openstreetmap.org/way/1069051171) | есть | есть | нет | нет | нет | 0.0 |
| 176 | 3183 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3183) | [way/1222082792](https://www.openstreetmap.org/way/1222082792) | есть | есть | нет | нет | нет | 4.5 |
| 177 | 3185 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3185) | [way/1127960827](https://www.openstreetmap.org/way/1127960827) | есть | есть | нет | нет | нет | 0.0 |
| 178 | 3186 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3186) | [way/1131162698](https://www.openstreetmap.org/way/1131162698) | есть | есть | нет | нет | нет | 0.0 |
| 179 | 3188 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3188) | [way/416302087](https://www.openstreetmap.org/way/416302087) | есть | есть | есть | нет | нет | 0.0 |
| 180 | 3189 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3189) | [way/1069051173](https://www.openstreetmap.org/way/1069051173) | есть | есть | нет | нет | нет | 0.0 |
| 181 | 3195 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3195) | [way/1227025950](https://www.openstreetmap.org/way/1227025950) | есть | есть | нет | нет | нет | 0.0 |
| 182 | 3266 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3266) | [way/416304834](https://www.openstreetmap.org/way/416304834) | есть | есть | нет | нет | нет | 0.0 |
| 183 | 4025 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4025) | [way/549065900](https://www.openstreetmap.org/way/549065900) | есть | есть | нет | нет | нет | 4.8 |
| 184 | 3663 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3663) | [way/337431831](https://www.openstreetmap.org/way/337431831) | есть | есть | нет | нет | нет | 0.0 |
| 185 | 4933 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4933) | [way/337425168](https://www.openstreetmap.org/way/337425168) | есть | есть | нет | нет | нет | 0.0 |
| 186 | 3641 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3641) | [way/337364809](https://www.openstreetmap.org/way/337364809) | есть | есть | нет | нет | нет | 0.0 |
| 187 | 2765 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=2765) | [way/148183332](https://www.openstreetmap.org/way/148183332) | есть | есть | нет | нет | нет | 0.0 |
| 188 | 15998 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=15998) | [way/1127991569](https://www.openstreetmap.org/way/1127991569) | есть | есть | нет | нет | нет | 0.0 |
| 189 | 3985 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3985) | [way/549425964](https://www.openstreetmap.org/way/549425964) | есть | есть | нет | нет | нет | 8.8 |
| 190 | 3721 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3721) | [way/337364752](https://www.openstreetmap.org/way/337364752) | есть | есть | нет | нет | нет | 2.0 |
| 191 | 3124 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3124) | [way/337373510](https://www.openstreetmap.org/way/337373510) | есть | есть | нет | нет | нет | 0.0 |
| 192 | 3733 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3733) | [way/1379177967](https://www.openstreetmap.org/way/1379177967) | есть | есть | нет | нет | нет | 1.0 |
| 193 | 3407 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3407) | [way/282242694](https://www.openstreetmap.org/way/282242694) | есть | есть | нет | нет | нет | 0.0 |
| 194 | 26457 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=26457) | [way/337420881](https://www.openstreetmap.org/way/337420881) | есть | есть | нет | нет | нет | 13.3 |
| 195 | 4117 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4117) | [way/555200458](https://www.openstreetmap.org/way/555200458) | есть | есть | нет | нет | нет | 16.1 |
| 196 | 3725 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3725) | [way/1221619301](https://www.openstreetmap.org/way/1221619301) | есть | нет | нет | нет | нет | 0.2 |
| 197 | 3734 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3734) | [way/549065889](https://www.openstreetmap.org/way/549065889) | есть | нет | нет | нет | нет | 1.0 |
| 198 | 16051 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16051) | [way/196658034](https://www.openstreetmap.org/way/196658034) | есть | нет | нет | нет | нет | 3.1 |
| 199 | 39244 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=39244) | [way/549065880](https://www.openstreetmap.org/way/549065880) | есть | нет | нет | нет | нет | 3.4 |
| 200 | 16020 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=16020) | [way/246787218](https://www.openstreetmap.org/way/246787218) | нет | есть | нет | нет | нет | 1.2 |

## Ограничения перед добавлением в каталог

- Это первичная очередь из реестра охраняемого наследия, а не редакционное решение о публикации. Отсеять не отдельные здания, дубли комплексов, разрушенные/перестроенные объекты и неуместные для атласа записи.
- Найденные OSM-контуры локальны и имеют лицензию ODbL; перед включением подтвердить геометрию, закрытые кольца и соответствие конкретному корпусу. Не использовать точку реестра как геометрию.
- Сначала проверить исторические факты по первичному источнику, отдельно отличая датировку существующего корпуса от периода участка/комплекса.
- У каждого снимка проверить здание, ракурс, авторство, лицензию и отдельные права на архитектурное произведение.
- Place ID необязателен для исторической карточки; Google API запускать только отдельным согласованным батчем с допуском 5 м.

Генератор: `python3 scripts/create-next-200-report.py --output docs/research-next-200-v2.md --exclude-queue docs/research-next-200.md --label "следующие 200 объектов Тбилиси (вторая очередь)"`. Флаг `--exclude-queue` исключает записи предыдущей очереди по ID реестра и OSM way; для перезаписи существующего отчёта нужен `--force`. Данные реестра запрашиваются по HTTPS с проверкой сертификата.
