# Исследовательская очередь: следующие 200 объектов Тбилиси (пятая очередь)

**Статус:** разобраны все 200: 100 READY, 83 HOLD, 17 REJECT; 40 интегрировано, 60 ждут перевода. Итоги — в [research-queue-v5-progress.md](research-queue-v5-progress.md).

Предыдущая очередь: [research-next-200-v4.md](research-next-200-v4.md), её итоги — в [research-queue-v4-progress.md](research-queue-v4-progress.md). После закрытия четвёртой очереди именованных объектов в реестре не осталось; очередь состоит из 200 лучших безымянных исторических жилых домов.

**Снимок:** 2026-11-01 UTC. Контуры: © участники OpenStreetMap, [ODbL](https://www.openstreetmap.org/copyright).

## Основание и метод

- В официальном реестре найдено записей по Тбилиси: **2599**. Запрос: `Region=N'თბილისი'` к [слою недвижимых памятников](https://memkvidreoba.gov.ge/arcgisch/rest/services/CultureWMS/PS_ImmovableMonumentObjectP/MapServer/1).
- Сопоставление выполнено с 121,313 контурами из локальной OSM-выгрузки `raw/osm-tbilisi-building-outlines.geojson` и 363 карточками атласа на момент отбора.
- Отобраны записи с классификацией архитектуры, отдельным контуром OSM в радиусе примерно 17 м, без близкого совпадения или значительного пересечения с текущей карточкой атласа. Сначала взяты записи с конкретным названием и содержательным описанием.
- Исключены все записи предыдущих очередей: `docs/research-next-200.md`, `docs/research-next-200-v2.md`, `docs/research-next-200-v3.md`, `docs/research-next-200-v4.md`. Это не даёт повторно отобрать уже разобранных кандидатов.
- Сопоставление точки реестра с контуром автоматическое. Даже расстояние 0 м не подтверждает, что реестр и контур относятся к одному корпусу; каждую пару нужно проверить на карте и по адресу.
- Официальные текстовые поля не перепечатываются в этом отчёте: условия повторного использования данных реестра не установлены. Идентификаторы нужны для открытия карточек источника.

## Сводка пробелов для отобранных 200

| Поле / проверка | Не хватает или нужно проверить | Что известно сейчас |
|---|---:|---|
| Адрес в реестре | 0/200 без адреса | Наличие поля не заменяет проверку адреса и перевод на русский, английский и украинский |
| Датировка в реестре | 0/200 без `ExactDate`; 176/200 без четырёхзначного года в строке | Год в строке также требует проверки: он может относиться к перестройке или диапазону |
| Описание в реестре | 0/200 без описания | Тексты источника на грузинском требуют редакционной выжимки и перевода |
| Номер реестра | 23/200 без `RegistryN` | `ObjectID` и ссылка на источник остаются доступны |
| Архитектор | 200/200 без тега архитектора в сопоставленном OSM-контуре | Отдельного поля архитектора в схеме реестра нет; нужна профильная проверка |
| Стиль | 200/200 без `building:architecture` в OSM | У реестра нет отдельного поля стиля; классифицировать по источнику/фасаду |
| Фото | 198/200 без тега `wikimedia_commons` у контура | Проверенной локальной галереи с автором, лицензией и правами пока нет |
| Геометрия | 0/200 без близкого контура OSM; 4/200 точек реестра дальше 5 м от сопоставленного контура | Все пары требуют ручного подтверждения принадлежности корпуса и качества Polygon |
| Переводы и карточка атласа | 200/200 | Нужны переводы имени, адреса и описания на ru/en/ka/uk, район, стиль/авторы с ID и редакционный текст |

## Список для ручной проверки

Таблица не содержит названий и адресов из реестра. Откройте карточку источника по ссылке; OSM way — только пространственный кандидат.

| № | ID реестра | Реестр | OSM way-кандидат | Адрес в источнике | Дата в источнике | Архитектор в OSM | Стиль в OSM | Commons-ссылка | Смещение точки, м |
|---:|---:|---|---|---|---|---|---|---|---:|
| 1 | 3826 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3826) | [way/337365205](https://www.openstreetmap.org/way/337365205) | есть | есть | нет | нет | нет | 0.0 |
| 2 | 3828 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3828) | [way/345185757](https://www.openstreetmap.org/way/345185757) | есть | есть | нет | нет | нет | 0.0 |
| 3 | 3832 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3832) | [way/1206434329](https://www.openstreetmap.org/way/1206434329) | есть | есть | нет | нет | нет | 0.0 |
| 4 | 3837 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3837) | [way/370845138](https://www.openstreetmap.org/way/370845138) | есть | есть | нет | нет | нет | 0.0 |
| 5 | 3841 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3841) | [way/1351037199](https://www.openstreetmap.org/way/1351037199) | есть | есть | нет | нет | нет | 0.0 |
| 6 | 3842 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3842) | [way/1217883921](https://www.openstreetmap.org/way/1217883921) | есть | есть | нет | нет | нет | 0.0 |
| 7 | 3843 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3843) | [way/1219556110](https://www.openstreetmap.org/way/1219556110) | есть | есть | нет | нет | нет | 1.0 |
| 8 | 3845 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3845) | [way/1217421942](https://www.openstreetmap.org/way/1217421942) | есть | есть | нет | нет | нет | 0.0 |
| 9 | 3848 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3848) | [way/1079021097](https://www.openstreetmap.org/way/1079021097) | есть | есть | нет | нет | нет | 0.0 |
| 10 | 3850 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3850) | [way/337356956](https://www.openstreetmap.org/way/337356956) | есть | есть | нет | нет | нет | 0.0 |
| 11 | 3854 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3854) | [way/762576382](https://www.openstreetmap.org/way/762576382) | есть | есть | нет | нет | нет | 0.0 |
| 12 | 3861 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3861) | [way/370543809](https://www.openstreetmap.org/way/370543809) | есть | есть | нет | нет | нет | 0.0 |
| 13 | 3869 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3869) | [way/1234448369](https://www.openstreetmap.org/way/1234448369) | есть | есть | нет | нет | нет | 0.0 |
| 14 | 3870 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3870) | [way/337540228](https://www.openstreetmap.org/way/337540228) | есть | есть | нет | нет | нет | 4.5 |
| 15 | 3871 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3871) | [way/1155841787](https://www.openstreetmap.org/way/1155841787) | есть | есть | нет | нет | нет | 0.0 |
| 16 | 3875 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3875) | [way/771660819](https://www.openstreetmap.org/way/771660819) | есть | есть | нет | нет | нет | 0.0 |
| 17 | 3876 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3876) | [way/1080996064](https://www.openstreetmap.org/way/1080996064) | есть | есть | нет | нет | нет | 0.0 |
| 18 | 3877 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3877) | [way/762576383](https://www.openstreetmap.org/way/762576383) | есть | есть | нет | нет | нет | 0.0 |
| 19 | 3881 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3881) | [way/1207148754](https://www.openstreetmap.org/way/1207148754) | есть | есть | нет | нет | нет | 0.0 |
| 20 | 3882 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3882) | [way/1155882472](https://www.openstreetmap.org/way/1155882472) | есть | есть | нет | нет | нет | 0.0 |
| 21 | 3883 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3883) | [way/1217421948](https://www.openstreetmap.org/way/1217421948) | есть | есть | нет | нет | нет | 0.0 |
| 22 | 3887 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3887) | [way/1126037597](https://www.openstreetmap.org/way/1126037597) | есть | есть | нет | нет | нет | 0.0 |
| 23 | 3892 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3892) | [way/1219618721](https://www.openstreetmap.org/way/1219618721) | есть | есть | нет | нет | нет | 0.0 |
| 24 | 3895 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3895) | [way/662313244](https://www.openstreetmap.org/way/662313244) | есть | есть | нет | нет | нет | 0.0 |
| 25 | 3899 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3899) | [way/1155911081](https://www.openstreetmap.org/way/1155911081) | есть | есть | нет | нет | нет | 0.0 |
| 26 | 3900 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3900) | [way/525916811](https://www.openstreetmap.org/way/525916811) | есть | есть | нет | нет | нет | 0.7 |
| 27 | 3903 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3903) | [way/65344858](https://www.openstreetmap.org/way/65344858) | есть | есть | нет | нет | нет | 0.0 |
| 28 | 3907 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3907) | [way/337357154](https://www.openstreetmap.org/way/337357154) | есть | есть | нет | нет | нет | 1.5 |
| 29 | 3909 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3909) | [way/337435416](https://www.openstreetmap.org/way/337435416) | есть | есть | нет | нет | нет | 0.0 |
| 30 | 3915 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3915) | [way/370845137](https://www.openstreetmap.org/way/370845137) | есть | есть | нет | нет | нет | 0.0 |
| 31 | 3916 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3916) | [way/370845570](https://www.openstreetmap.org/way/370845570) | есть | есть | нет | нет | нет | 0.0 |
| 32 | 3917 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3917) | [way/370846842](https://www.openstreetmap.org/way/370846842) | есть | есть | нет | нет | нет | 15.2 |
| 33 | 3926 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3926) | [way/1126037603](https://www.openstreetmap.org/way/1126037603) | есть | есть | нет | нет | нет | 1.8 |
| 34 | 3927 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3927) | [way/565074661](https://www.openstreetmap.org/way/565074661) | есть | есть | нет | нет | нет | 0.0 |
| 35 | 3929 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3929) | [way/1155911047](https://www.openstreetmap.org/way/1155911047) | есть | есть | нет | нет | нет | 0.0 |
| 36 | 3931 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3931) | [way/282045910](https://www.openstreetmap.org/way/282045910) | есть | есть | нет | нет | нет | 0.0 |
| 37 | 3932 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3932) | [way/1189979343](https://www.openstreetmap.org/way/1189979343) | есть | есть | нет | нет | нет | 0.0 |
| 38 | 3940 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3940) | [way/1219711390](https://www.openstreetmap.org/way/1219711390) | есть | есть | нет | нет | нет | 0.0 |
| 39 | 3941 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3941) | [way/1165490173](https://www.openstreetmap.org/way/1165490173) | есть | есть | нет | нет | нет | 0.0 |
| 40 | 3942 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3942) | [way/159820999](https://www.openstreetmap.org/way/159820999) | есть | есть | нет | нет | нет | 0.0 |
| 41 | 3945 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3945) | [way/1206705372](https://www.openstreetmap.org/way/1206705372) | есть | есть | нет | нет | нет | 0.0 |
| 42 | 3947 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3947) | [way/1219711360](https://www.openstreetmap.org/way/1219711360) | есть | есть | нет | нет | нет | 0.0 |
| 43 | 3950 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3950) | [way/1221776592](https://www.openstreetmap.org/way/1221776592) | есть | есть | нет | нет | нет | 0.0 |
| 44 | 3951 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3951) | [way/762576369](https://www.openstreetmap.org/way/762576369) | есть | есть | нет | нет | нет | 0.2 |
| 45 | 3953 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3953) | [way/1219711380](https://www.openstreetmap.org/way/1219711380) | есть | есть | нет | нет | нет | 0.0 |
| 46 | 3956 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3956) | [way/1206736168](https://www.openstreetmap.org/way/1206736168) | есть | есть | нет | нет | нет | 0.0 |
| 47 | 3958 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3958) | [way/1043852170](https://www.openstreetmap.org/way/1043852170) | есть | есть | нет | нет | нет | 0.0 |
| 48 | 3959 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3959) | [way/142657229](https://www.openstreetmap.org/way/142657229) | есть | есть | нет | нет | нет | 0.0 |
| 49 | 3962 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3962) | [way/530815305](https://www.openstreetmap.org/way/530815305) | есть | есть | нет | нет | нет | 0.0 |
| 50 | 3964 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3964) | [way/1165490182](https://www.openstreetmap.org/way/1165490182) | есть | есть | нет | нет | нет | 0.0 |
| 51 | 3972 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3972) | [way/253283539](https://www.openstreetmap.org/way/253283539) | есть | есть | нет | нет | нет | 0.0 |
| 52 | 3973 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3973) | [way/549425985](https://www.openstreetmap.org/way/549425985) | есть | есть | нет | нет | нет | 0.0 |
| 53 | 3979 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3979) | [way/1126044284](https://www.openstreetmap.org/way/1126044284) | есть | есть | нет | нет | нет | 0.0 |
| 54 | 3984 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3984) | [way/337364746](https://www.openstreetmap.org/way/337364746) | есть | есть | нет | нет | нет | 0.0 |
| 55 | 3988 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3988) | [way/310519023](https://www.openstreetmap.org/way/310519023) | есть | есть | нет | нет | нет | 0.0 |
| 56 | 3994 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3994) | [way/1165479239](https://www.openstreetmap.org/way/1165479239) | есть | есть | нет | нет | нет | 0.0 |
| 57 | 3996 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3996) | [way/641459425](https://www.openstreetmap.org/way/641459425) | есть | есть | нет | нет | нет | 0.0 |
| 58 | 3999 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3999) | [way/1327287038](https://www.openstreetmap.org/way/1327287038) | есть | есть | нет | нет | нет | 0.0 |
| 59 | 4004 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4004) | [way/1079021084](https://www.openstreetmap.org/way/1079021084) | есть | есть | нет | нет | нет | 0.0 |
| 60 | 4005 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4005) | [way/1079021087](https://www.openstreetmap.org/way/1079021087) | есть | есть | нет | нет | нет | 0.0 |
| 61 | 4009 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4009) | [way/565074675](https://www.openstreetmap.org/way/565074675) | есть | есть | нет | нет | нет | 0.0 |
| 62 | 4010 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4010) | [way/78024612](https://www.openstreetmap.org/way/78024612) | есть | есть | нет | нет | нет | 0.0 |
| 63 | 4012 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4012) | [way/555200531](https://www.openstreetmap.org/way/555200531) | есть | есть | нет | нет | нет | 0.0 |
| 64 | 4013 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4013) | [way/369233598](https://www.openstreetmap.org/way/369233598) | есть | есть | нет | нет | нет | 0.0 |
| 65 | 4018 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4018) | [way/157005317](https://www.openstreetmap.org/way/157005317) | есть | есть | нет | нет | нет | 0.0 |
| 66 | 4019 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4019) | [way/530818470](https://www.openstreetmap.org/way/530818470) | есть | есть | нет | нет | нет | 0.0 |
| 67 | 4020 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4020) | [way/282057533](https://www.openstreetmap.org/way/282057533) | есть | есть | нет | нет | нет | 0.0 |
| 68 | 4034 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4034) | [way/1216647755](https://www.openstreetmap.org/way/1216647755) | есть | есть | нет | нет | нет | 0.0 |
| 69 | 4035 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4035) | [way/549065876](https://www.openstreetmap.org/way/549065876) | есть | есть | нет | нет | нет | 0.0 |
| 70 | 4036 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4036) | [way/641459433](https://www.openstreetmap.org/way/641459433) | есть | есть | нет | нет | нет | 0.0 |
| 71 | 4037 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4037) | [way/1327116085](https://www.openstreetmap.org/way/1327116085) | есть | есть | нет | нет | нет | 0.0 |
| 72 | 4042 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4042) | [way/1206736167](https://www.openstreetmap.org/way/1206736167) | есть | есть | нет | нет | нет | 0.0 |
| 73 | 4045 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4045) | [way/281627268](https://www.openstreetmap.org/way/281627268) | есть | есть | нет | нет | нет | 0.0 |
| 74 | 4051 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4051) | [way/555209471](https://www.openstreetmap.org/way/555209471) | есть | есть | нет | нет | нет | 0.0 |
| 75 | 4054 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4054) | [way/283111797](https://www.openstreetmap.org/way/283111797) | есть | есть | нет | нет | нет | 0.0 |
| 76 | 4059 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4059) | [way/1366028873](https://www.openstreetmap.org/way/1366028873) | есть | есть | нет | нет | нет | 0.0 |
| 77 | 4061 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4061) | [way/143349179](https://www.openstreetmap.org/way/143349179) | есть | есть | нет | нет | нет | 0.0 |
| 78 | 4066 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4066) | [way/304962120](https://www.openstreetmap.org/way/304962120) | есть | есть | нет | нет | нет | 0.0 |
| 79 | 4068 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4068) | [way/1186008208](https://www.openstreetmap.org/way/1186008208) | есть | есть | нет | нет | нет | 0.0 |
| 80 | 4080 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4080) | [way/1158299598](https://www.openstreetmap.org/way/1158299598) | есть | есть | нет | нет | нет | 0.0 |
| 81 | 4088 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4088) | [way/1206891475](https://www.openstreetmap.org/way/1206891475) | есть | есть | нет | нет | нет | 0.0 |
| 82 | 4090 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4090) | [way/1234448352](https://www.openstreetmap.org/way/1234448352) | есть | есть | нет | нет | нет | 0.0 |
| 83 | 4094 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4094) | [way/580155974](https://www.openstreetmap.org/way/580155974) | есть | есть | нет | нет | нет | 0.0 |
| 84 | 4095 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4095) | [way/281627273](https://www.openstreetmap.org/way/281627273) | есть | есть | нет | нет | нет | 0.0 |
| 85 | 4120 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4120) | [way/1165978365](https://www.openstreetmap.org/way/1165978365) | есть | есть | нет | нет | нет | 0.0 |
| 86 | 4125 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4125) | [way/310519022](https://www.openstreetmap.org/way/310519022) | есть | есть | нет | нет | нет | 0.0 |
| 87 | 4127 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4127) | [way/1165978350](https://www.openstreetmap.org/way/1165978350) | есть | есть | нет | нет | нет | 0.0 |
| 88 | 4128 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4128) | [way/1187273090](https://www.openstreetmap.org/way/1187273090) | есть | есть | нет | нет | нет | 0.0 |
| 89 | 4139 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4139) | [way/1327116084](https://www.openstreetmap.org/way/1327116084) | есть | есть | нет | нет | нет | 0.0 |
| 90 | 4153 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4153) | [way/279588591](https://www.openstreetmap.org/way/279588591) | есть | есть | нет | нет | нет | 0.0 |
| 91 | 4155 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4155) | [way/762576379](https://www.openstreetmap.org/way/762576379) | есть | есть | нет | нет | нет | 0.0 |
| 92 | 4158 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4158) | [way/281562111](https://www.openstreetmap.org/way/281562111) | есть | есть | нет | нет | нет | 0.0 |
| 93 | 4159 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4159) | [way/707934273](https://www.openstreetmap.org/way/707934273) | есть | есть | нет | нет | нет | 0.0 |
| 94 | 4161 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4161) | [way/281627275](https://www.openstreetmap.org/way/281627275) | есть | есть | нет | нет | нет | 0.0 |
| 95 | 4163 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4163) | [way/1206891462](https://www.openstreetmap.org/way/1206891462) | есть | есть | нет | нет | нет | 0.0 |
| 96 | 4173 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4173) | [way/282047459](https://www.openstreetmap.org/way/282047459) | есть | есть | нет | нет | нет | 14.4 |
| 97 | 4178 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4178) | [way/1207197412](https://www.openstreetmap.org/way/1207197412) | есть | есть | нет | нет | нет | 0.0 |
| 98 | 4180 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4180) | [way/1206575073](https://www.openstreetmap.org/way/1206575073) | есть | есть | нет | нет | нет | 9.6 |
| 99 | 4188 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4188) | [way/1221837875](https://www.openstreetmap.org/way/1221837875) | есть | есть | нет | нет | нет | 0.0 |
| 100 | 4189 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4189) | [way/1043852167](https://www.openstreetmap.org/way/1043852167) | есть | есть | нет | нет | нет | 0.0 |
| 101 | 4191 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4191) | [way/369233600](https://www.openstreetmap.org/way/369233600) | есть | есть | нет | нет | нет | 0.0 |
| 102 | 4198 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4198) | [way/254277283](https://www.openstreetmap.org/way/254277283) | есть | есть | нет | нет | нет | 0.0 |
| 103 | 4201 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4201) | [way/1382755327](https://www.openstreetmap.org/way/1382755327) | есть | есть | нет | нет | нет | 0.0 |
| 104 | 4214 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4214) | [way/190038731](https://www.openstreetmap.org/way/190038731) | есть | есть | нет | нет | нет | 0.0 |
| 105 | 4217 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4217) | [way/1327295181](https://www.openstreetmap.org/way/1327295181) | есть | есть | нет | нет | нет | 0.0 |
| 106 | 4218 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4218) | [way/1382755325](https://www.openstreetmap.org/way/1382755325) | есть | есть | нет | нет | нет | 0.0 |
| 107 | 4223 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4223) | [way/337241806](https://www.openstreetmap.org/way/337241806) | есть | есть | нет | нет | нет | 0.0 |
| 108 | 4230 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4230) | [way/287672969](https://www.openstreetmap.org/way/287672969) | есть | есть | нет | нет | нет | 0.0 |
| 109 | 4233 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4233) | [way/1080996070](https://www.openstreetmap.org/way/1080996070) | есть | есть | нет | нет | нет | 0.2 |
| 110 | 4243 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4243) | [way/335437651](https://www.openstreetmap.org/way/335437651) | есть | есть | нет | нет | нет | 0.0 |
| 111 | 4244 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4244) | [way/1233866257](https://www.openstreetmap.org/way/1233866257) | есть | есть | нет | нет | нет | 0.0 |
| 112 | 4250 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4250) | [way/1215608043](https://www.openstreetmap.org/way/1215608043) | есть | есть | нет | нет | есть | 0.0 |
| 113 | 4252 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4252) | [way/1165490181](https://www.openstreetmap.org/way/1165490181) | есть | есть | нет | нет | нет | 0.0 |
| 114 | 4253 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4253) | [way/565074652](https://www.openstreetmap.org/way/565074652) | есть | есть | нет | нет | нет | 0.0 |
| 115 | 4254 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4254) | [way/555209486](https://www.openstreetmap.org/way/555209486) | есть | есть | нет | нет | нет | 0.0 |
| 116 | 4255 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4255) | [way/190490315](https://www.openstreetmap.org/way/190490315) | есть | есть | нет | нет | нет | 0.0 |
| 117 | 4259 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4259) | [way/565074623](https://www.openstreetmap.org/way/565074623) | есть | есть | нет | нет | нет | 0.0 |
| 118 | 4261 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4261) | [way/281627267](https://www.openstreetmap.org/way/281627267) | есть | есть | нет | нет | нет | 0.0 |
| 119 | 4263 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4263) | [way/337850535](https://www.openstreetmap.org/way/337850535) | есть | есть | нет | нет | нет | 0.0 |
| 120 | 4264 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4264) | [way/707934278](https://www.openstreetmap.org/way/707934278) | есть | есть | нет | нет | нет | 0.0 |
| 121 | 4269 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4269) | [way/1206575053](https://www.openstreetmap.org/way/1206575053) | есть | есть | нет | нет | нет | 0.0 |
| 122 | 4270 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4270) | [way/1234146256](https://www.openstreetmap.org/way/1234146256) | есть | есть | нет | нет | нет | 0.0 |
| 123 | 4278 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4278) | [way/762576361](https://www.openstreetmap.org/way/762576361) | есть | есть | нет | нет | нет | 0.0 |
| 124 | 4279 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4279) | [way/375518790](https://www.openstreetmap.org/way/375518790) | есть | есть | нет | нет | нет | 0.0 |
| 125 | 4280 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4280) | [way/1125012313](https://www.openstreetmap.org/way/1125012313) | есть | есть | нет | нет | нет | 0.0 |
| 126 | 4281 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4281) | [way/565074606](https://www.openstreetmap.org/way/565074606) | есть | есть | нет | нет | нет | 0.0 |
| 127 | 4284 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4284) | [way/281244309](https://www.openstreetmap.org/way/281244309) | есть | есть | нет | нет | нет | 0.0 |
| 128 | 4296 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4296) | [way/555209492](https://www.openstreetmap.org/way/555209492) | есть | есть | нет | нет | нет | 0.0 |
| 129 | 4301 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4301) | [way/1234448378](https://www.openstreetmap.org/way/1234448378) | есть | есть | нет | нет | нет | 0.0 |
| 130 | 4302 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4302) | [way/1265588835](https://www.openstreetmap.org/way/1265588835) | есть | есть | нет | нет | нет | 0.0 |
| 131 | 4310 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4310) | [way/339718741](https://www.openstreetmap.org/way/339718741) | есть | есть | нет | нет | нет | 0.0 |
| 132 | 4315 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4315) | [way/1156148499](https://www.openstreetmap.org/way/1156148499) | есть | есть | нет | нет | нет | 0.0 |
| 133 | 4321 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4321) | [way/580171157](https://www.openstreetmap.org/way/580171157) | есть | есть | нет | нет | нет | 0.0 |
| 134 | 4323 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4323) | [way/555209472](https://www.openstreetmap.org/way/555209472) | есть | есть | нет | нет | нет | 0.0 |
| 135 | 4324 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4324) | [way/337850857](https://www.openstreetmap.org/way/337850857) | есть | есть | нет | нет | нет | 0.0 |
| 136 | 4325 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4325) | [way/1043852173](https://www.openstreetmap.org/way/1043852173) | есть | есть | нет | нет | нет | 0.0 |
| 137 | 4326 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4326) | [way/159818807](https://www.openstreetmap.org/way/159818807) | есть | есть | нет | нет | нет | 0.0 |
| 138 | 4327 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4327) | [way/1165490183](https://www.openstreetmap.org/way/1165490183) | есть | есть | нет | нет | нет | 0.0 |
| 139 | 4339 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4339) | [way/281562098](https://www.openstreetmap.org/way/281562098) | есть | есть | нет | нет | нет | 0.0 |
| 140 | 4340 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4340) | [way/538668880](https://www.openstreetmap.org/way/538668880) | есть | есть | нет | нет | нет | 0.0 |
| 141 | 4353 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4353) | [way/337356142](https://www.openstreetmap.org/way/337356142) | есть | есть | нет | нет | нет | 0.0 |
| 142 | 4354 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4354) | [way/1158299592](https://www.openstreetmap.org/way/1158299592) | есть | есть | нет | нет | нет | 0.0 |
| 143 | 4356 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4356) | [way/1360947794](https://www.openstreetmap.org/way/1360947794) | есть | есть | нет | нет | нет | 0.0 |
| 144 | 4363 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4363) | [way/370543811](https://www.openstreetmap.org/way/370543811) | есть | есть | нет | нет | нет | 0.0 |
| 145 | 4377 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4377) | [way/580171156](https://www.openstreetmap.org/way/580171156) | есть | есть | нет | нет | нет | 0.0 |
| 146 | 4380 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4380) | [way/337856665](https://www.openstreetmap.org/way/337856665) | есть | есть | нет | нет | нет | 0.0 |
| 147 | 4383 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4383) | [way/1305830030](https://www.openstreetmap.org/way/1305830030) | есть | есть | нет | нет | нет | 0.0 |
| 148 | 4389 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4389) | [way/294971083](https://www.openstreetmap.org/way/294971083) | есть | есть | нет | нет | нет | 0.0 |
| 149 | 4391 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4391) | [way/1165490172](https://www.openstreetmap.org/way/1165490172) | есть | есть | нет | нет | нет | 0.0 |
| 150 | 4392 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4392) | [way/375518788](https://www.openstreetmap.org/way/375518788) | есть | есть | нет | нет | нет | 0.0 |
| 151 | 4397 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4397) | [way/1234448348](https://www.openstreetmap.org/way/1234448348) | есть | есть | нет | нет | нет | 0.0 |
| 152 | 4398 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4398) | [way/281562101](https://www.openstreetmap.org/way/281562101) | есть | есть | нет | нет | нет | 0.0 |
| 153 | 4401 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4401) | [way/375514378](https://www.openstreetmap.org/way/375514378) | есть | есть | нет | нет | нет | 0.0 |
| 154 | 4403 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4403) | [way/294973889](https://www.openstreetmap.org/way/294973889) | есть | есть | нет | нет | нет | 0.0 |
| 155 | 4404 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4404) | [way/1327079472](https://www.openstreetmap.org/way/1327079472) | есть | есть | нет | нет | нет | 0.0 |
| 156 | 4426 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4426) | [way/1221776580](https://www.openstreetmap.org/way/1221776580) | есть | есть | нет | нет | нет | 0.0 |
| 157 | 4434 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4434) | [way/282436189](https://www.openstreetmap.org/way/282436189) | есть | есть | нет | нет | нет | 0.0 |
| 158 | 4449 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4449) | [way/198114875](https://www.openstreetmap.org/way/198114875) | есть | есть | нет | нет | нет | 0.0 |
| 159 | 4450 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4450) | [way/1234146257](https://www.openstreetmap.org/way/1234146257) | есть | есть | нет | нет | нет | 0.0 |
| 160 | 4459 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4459) | [way/148245102](https://www.openstreetmap.org/way/148245102) | есть | есть | нет | нет | нет | 0.0 |
| 161 | 4465 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4465) | [way/632268889](https://www.openstreetmap.org/way/632268889) | есть | есть | нет | нет | нет | 0.0 |
| 162 | 4471 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4471) | [way/281627269](https://www.openstreetmap.org/way/281627269) | есть | есть | нет | нет | нет | 0.0 |
| 163 | 4479 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4479) | [way/188562925](https://www.openstreetmap.org/way/188562925) | есть | есть | нет | нет | нет | 0.0 |
| 164 | 4480 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4480) | [way/280569708](https://www.openstreetmap.org/way/280569708) | есть | есть | нет | нет | нет | 0.0 |
| 165 | 4481 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4481) | [way/281562093](https://www.openstreetmap.org/way/281562093) | есть | есть | нет | нет | нет | 0.0 |
| 166 | 4482 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4482) | [way/287672955](https://www.openstreetmap.org/way/287672955) | есть | есть | нет | нет | нет | 0.0 |
| 167 | 4485 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4485) | [way/282436197](https://www.openstreetmap.org/way/282436197) | есть | есть | нет | нет | есть | 0.0 |
| 168 | 4487 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4487) | [way/1227455595](https://www.openstreetmap.org/way/1227455595) | есть | есть | нет | нет | нет | 0.0 |
| 169 | 4492 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4492) | [way/287500845](https://www.openstreetmap.org/way/287500845) | есть | есть | нет | нет | нет | 0.0 |
| 170 | 4500 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4500) | [way/1327079473](https://www.openstreetmap.org/way/1327079473) | есть | есть | нет | нет | нет | 0.7 |
| 171 | 4505 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4505) | [way/190475630](https://www.openstreetmap.org/way/190475630) | есть | есть | нет | нет | нет | 0.0 |
| 172 | 4508 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4508) | [way/1215608042](https://www.openstreetmap.org/way/1215608042) | есть | есть | нет | нет | нет | 0.0 |
| 173 | 4517 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4517) | [way/1227455608](https://www.openstreetmap.org/way/1227455608) | есть | есть | нет | нет | нет | 0.0 |
| 174 | 4526 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4526) | [way/1081144707](https://www.openstreetmap.org/way/1081144707) | есть | есть | нет | нет | нет | 0.0 |
| 175 | 4527 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4527) | [way/1327116080](https://www.openstreetmap.org/way/1327116080) | есть | есть | нет | нет | нет | 0.0 |
| 176 | 4528 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4528) | [way/337426146](https://www.openstreetmap.org/way/337426146) | есть | есть | нет | нет | нет | 0.0 |
| 177 | 4529 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4529) | [way/1314743157](https://www.openstreetmap.org/way/1314743157) | есть | есть | нет | нет | нет | 0.0 |
| 178 | 4533 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4533) | [way/1265588837](https://www.openstreetmap.org/way/1265588837) | есть | есть | нет | нет | нет | 0.0 |
| 179 | 4534 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4534) | [way/1165490176](https://www.openstreetmap.org/way/1165490176) | есть | есть | нет | нет | нет | 0.0 |
| 180 | 4539 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4539) | [way/304962119](https://www.openstreetmap.org/way/304962119) | есть | есть | нет | нет | нет | 0.0 |
| 181 | 4547 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4547) | [way/1125014795](https://www.openstreetmap.org/way/1125014795) | есть | есть | нет | нет | нет | 0.0 |
| 182 | 4548 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4548) | [way/1234146254](https://www.openstreetmap.org/way/1234146254) | есть | есть | нет | нет | нет | 0.0 |
| 183 | 4550 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4550) | [way/188562915](https://www.openstreetmap.org/way/188562915) | есть | есть | нет | нет | нет | 0.0 |
| 184 | 4557 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4557) | [way/1227455557](https://www.openstreetmap.org/way/1227455557) | есть | есть | нет | нет | нет | 0.0 |
| 185 | 4558 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4558) | [way/1265588836](https://www.openstreetmap.org/way/1265588836) | есть | есть | нет | нет | нет | 0.0 |
| 186 | 4562 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4562) | [way/279588594](https://www.openstreetmap.org/way/279588594) | есть | есть | нет | нет | нет | 0.0 |
| 187 | 4570 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4570) | [way/509980606](https://www.openstreetmap.org/way/509980606) | есть | есть | нет | нет | нет | 11.5 |
| 188 | 4571 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4571) | [way/304962118](https://www.openstreetmap.org/way/304962118) | есть | есть | нет | нет | нет | 0.0 |
| 189 | 4572 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4572) | [way/1227455604](https://www.openstreetmap.org/way/1227455604) | есть | есть | нет | нет | нет | 0.0 |
| 190 | 4577 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4577) | [way/1206575071](https://www.openstreetmap.org/way/1206575071) | есть | есть | нет | нет | нет | 0.0 |
| 191 | 4578 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4578) | [way/1234146277](https://www.openstreetmap.org/way/1234146277) | есть | есть | нет | нет | нет | 0.0 |
| 192 | 4582 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4582) | [way/294972637](https://www.openstreetmap.org/way/294972637) | есть | есть | нет | нет | нет | 0.0 |
| 193 | 4584 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4584) | [way/281100754](https://www.openstreetmap.org/way/281100754) | есть | есть | нет | нет | нет | 4.4 |
| 194 | 4585 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4585) | [way/281562099](https://www.openstreetmap.org/way/281562099) | есть | есть | нет | нет | нет | 0.0 |
| 195 | 4588 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4588) | [way/1220380984](https://www.openstreetmap.org/way/1220380984) | есть | есть | нет | нет | нет | 0.0 |
| 196 | 4597 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4597) | [way/1234448381](https://www.openstreetmap.org/way/1234448381) | есть | есть | нет | нет | нет | 0.0 |
| 197 | 4599 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4599) | [way/281100763](https://www.openstreetmap.org/way/281100763) | есть | есть | нет | нет | нет | 0.0 |
| 198 | 4602 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4602) | [way/1125012317](https://www.openstreetmap.org/way/1125012317) | есть | есть | нет | нет | нет | 0.0 |
| 199 | 4610 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4610) | [way/190475716](https://www.openstreetmap.org/way/190475716) | есть | есть | нет | нет | нет | 3.1 |
| 200 | 4611 | [карточка](https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4611) | [way/1382755329](https://www.openstreetmap.org/way/1382755329) | есть | есть | нет | нет | нет | 0.0 |

## Ограничения перед добавлением в каталог

- Это первичная очередь из реестра охраняемого наследия, а не редакционное решение о публикации. Отсеять не отдельные здания, дубли комплексов, разрушенные/перестроенные объекты и неуместные для атласа записи.
- Найденные OSM-контуры локальны и имеют лицензию ODbL; перед включением подтвердить геометрию, закрытые кольца и соответствие конкретному корпусу. Не использовать точку реестра как геометрию.
- Сначала проверить исторические факты по первичному источнику, отдельно отличая датировку существующего корпуса от периода участка/комплекса.
- У каждого снимка проверить здание, ракурс, авторство, лицензию и отдельные права на архитектурное произведение.
- Place ID необязателен для исторической карточки; Google API запускать только отдельным согласованным батчем с допуском 5 м.

Генератор: `python3 scripts/create-next-200-report.py --output docs/research-next-200-v2.md --exclude-queue docs/research-next-200.md --label "следующие 200 объектов Тбилиси (вторая очередь)"`. Флаг `--exclude-queue` исключает записи предыдущей очереди по ID реестра и OSM way; для перезаписи существующего отчёта нужен `--force`. Данные реестра запрашиваются по HTTPS с проверкой сертификата.
