# Пересечения очереди из 200 контуров с текущим атласом

Проверено 31 октября 2026 года по состоянию workspace: 200 кандидатских OSM-контуров из очереди сравнены с 104 Polygon/MultiPolygon в `public/atlas/buildings.json` (20 800 пар). Идентификаторы реестра и предлагаемых OSM ways взяты из [исследовательской очереди](research-next-200.md). Все 200 way ID найдены в локальной выгрузке `raw/osm-tbilisi-building-outlines.geojson`; она использована как источник геометрии кандидатов.

## Метод

Геометрии преобразованы в локальную метрическую аппроксимацию для Тбилиси: `X = longitude × 111320 × cos(41,7°)`, `Y = latitude × 111320`. Для каждой из 20 800 пар проверено топологическое пересечение с Shapely. В таблице доля кандидата равна `площадь пересечения / площадь контура кандидата`; доля карточки равна `площадь пересечения / площадь контура карточки`. Площадь дана в м². Касание без общей площади отдельно обозначено. Сохранены численные результаты без отсечения малых фрагментов, поэтому значения менее 1 м² — тонкие краевые наложения, а не подтверждённое совпадение здания.

**Итог:** 11 пар имеют положительную площадь пересечения, ещё 1 пара касается границ; это 11 различных контуров кандидатов. Четыре пары имеют полное совпадение геометрий (№5, 10, 33, 57); остальные положительные пересечения малы и требуют визуальной проверки. В остальных 189 строках нет ни площадного пересечения, ни касания ни с одной из 104 карточек.

В строке с несколькими карточками значения в четырёх столбцах перечислены в одинаковом порядке, через `<br>`. Если совпадений нет, карточка указана как `—`, площадь и доли равны нулю. Никакое пересечение не доказывает тождество объектов: возможны ошибки OSM, соседние корпуса и разные способы обводки ансамбля. Непересечение не исключает, что один памятник и карточка описывают соседние корпуса одного комплекса. Это расстояние/пересечение геометрий, не расстояние от реестровой точки до кандидатского контура.

## Все 200 контуров

| № очереди | ID реестра | OSM way | Пересекающиеся карточки атласа | Площадь пересечения по порядку карточек | Доля контура кандидата | Доля контура карточки |
|---:|---:|---|---|---:|---:|---:|
| 1 | 2676 | [way/1157284971](https://www.openstreetmap.org/way/1157284971) | — | — | 0% | 0% |
| 2 | 2684 | [way/1278166606](https://www.openstreetmap.org/way/1278166606) | — | — | 0% | 0% |
| 3 | 2694 | [way/691709671](https://www.openstreetmap.org/way/691709671) | — | — | 0% | 0% |
| 4 | 2764 | [way/78500061](https://www.openstreetmap.org/way/78500061) | — | — | 0% | 0% |
| 5 | 2780 | [way/78509293](https://www.openstreetmap.org/way/78509293) | osm-78509293 | 818.688865 м² | 100.00000000% | 100.00000000% |
| 6 | 2841 | [way/246757401](https://www.openstreetmap.org/way/246757401) | — | — | 0% | 0% |
| 7 | 2850 | [way/218121310](https://www.openstreetmap.org/way/218121310) | — | — | 0% | 0% |
| 8 | 2858 | [way/417138961](https://www.openstreetmap.org/way/417138961) | — | — | 0% | 0% |
| 9 | 2902 | [way/1276208586](https://www.openstreetmap.org/way/1276208586) | — | — | 0% | 0% |
| 10 | 2914 | [way/65158233](https://www.openstreetmap.org/way/65158233) | osm-65158233 | 1460.850301 м² | 100.00000000% | 100.00000000% |
| 11 | 2986 | [way/565040626](https://www.openstreetmap.org/way/565040626) | — | — | 0% | 0% |
| 12 | 2991 | [way/337421240](https://www.openstreetmap.org/way/337421240) | — | — | 0% | 0% |
| 13 | 3016 | [way/57038408](https://www.openstreetmap.org/way/57038408) | — | — | 0% | 0% |
| 14 | 3040 | [way/1484742676](https://www.openstreetmap.org/way/1484742676) | — | — | 0% | 0% |
| 15 | 3049 | [way/246769267](https://www.openstreetmap.org/way/246769267) | — | — | 0% | 0% |
| 16 | 3064 | [way/76960033](https://www.openstreetmap.org/way/76960033) | — | — | 0% | 0% |
| 17 | 3069 | [way/108197961](https://www.openstreetmap.org/way/108197961) | — | — | 0% | 0% |
| 18 | 3100 | [way/1365593642](https://www.openstreetmap.org/way/1365593642) | — | — | 0% | 0% |
| 19 | 3108 | [way/1070396839](https://www.openstreetmap.org/way/1070396839) | — | — | 0% | 0% |
| 20 | 3137 | [way/57037627](https://www.openstreetmap.org/way/57037627) | — | — | 0% | 0% |
| 21 | 3173 | [way/1013499785](https://www.openstreetmap.org/way/1013499785) | — | — | 0% | 0% |
| 22 | 3175 | [way/1218781712](https://www.openstreetmap.org/way/1218781712) | — | — | 0% | 0% |
| 23 | 3178 | [way/462897308](https://www.openstreetmap.org/way/462897308) | — | — | 0% | 0% |
| 24 | 3187 | [way/1188424739](https://www.openstreetmap.org/way/1188424739) | — | — | 0% | 0% |
| 25 | 3190 | [way/1188424740](https://www.openstreetmap.org/way/1188424740) | — | — | 0% | 0% |
| 26 | 3193 | [way/555413425](https://www.openstreetmap.org/way/555413425) | — | — | 0% | 0% |
| 27 | 3227 | [way/282713323](https://www.openstreetmap.org/way/282713323) | — | — | 0% | 0% |
| 28 | 3229 | [way/57037626](https://www.openstreetmap.org/way/57037626) | — | — | 0% | 0% |
| 29 | 3239 | [way/217530856](https://www.openstreetmap.org/way/217530856) | — | — | 0% | 0% |
| 30 | 3244 | [way/192201132](https://www.openstreetmap.org/way/192201132) | — | — | 0% | 0% |
| 31 | 3246 | [way/102691273](https://www.openstreetmap.org/way/102691273) | — | — | 0% | 0% |
| 32 | 3257 | [way/415940826](https://www.openstreetmap.org/way/415940826) | — | — | 0% | 0% |
| 33 | 3303 | [way/462898536](https://www.openstreetmap.org/way/462898536) | osm-462898536 | 1162.343240 м² | 100.00000000% | 100.00000000% |
| 34 | 3310 | [way/462897306](https://www.openstreetmap.org/way/462897306) | — | — | 0% | 0% |
| 35 | 3321 | [way/462897300](https://www.openstreetmap.org/way/462897300) | — | — | 0% | 0% |
| 36 | 3331 | [way/1217883918](https://www.openstreetmap.org/way/1217883918) | — | — | 0% | 0% |
| 37 | 3332 | [way/78144732](https://www.openstreetmap.org/way/78144732) | — | — | 0% | 0% |
| 38 | 3369 | [way/123574142](https://www.openstreetmap.org/way/123574142) | — | — | 0% | 0% |
| 39 | 3386 | [way/661357924](https://www.openstreetmap.org/way/661357924) | — | — | 0% | 0% |
| 40 | 3393 | [way/1219556099](https://www.openstreetmap.org/way/1219556099) | — | — | 0% | 0% |
| 41 | 3397 | [way/758009917](https://www.openstreetmap.org/way/758009917) | — | — | 0% | 0% |
| 42 | 3411 | [way/899099223](https://www.openstreetmap.org/way/899099223) | — | — | 0% | 0% |
| 43 | 3432 | [way/198140489](https://www.openstreetmap.org/way/198140489) | — | — | 0% | 0% |
| 44 | 3435 | [way/417693230](https://www.openstreetmap.org/way/417693230) | — | — | 0% | 0% |
| 45 | 3450 | [way/1069038401](https://www.openstreetmap.org/way/1069038401) | — | — | 0% | 0% |
| 46 | 3466 | [way/549065841](https://www.openstreetmap.org/way/549065841) | — | — | 0% | 0% |
| 47 | 3486 | [way/817688095](https://www.openstreetmap.org/way/817688095) | — | — | 0% | 0% |
| 48 | 3505 | [way/370845143](https://www.openstreetmap.org/way/370845143) | — | — | 0% | 0% |
| 49 | 3506 | [way/282057534](https://www.openstreetmap.org/way/282057534) | — | — | 0% | 0% |
| 50 | 3512 | [way/1206434249](https://www.openstreetmap.org/way/1206434249) | — | — | 0% | 0% |
| 51 | 3534 | [way/198140507](https://www.openstreetmap.org/way/198140507) | — | — | 0% | 0% |
| 52 | 3540 | [way/198125060](https://www.openstreetmap.org/way/198125060) | — | — | 0% | 0% |
| 53 | 3567 | [way/282713325](https://www.openstreetmap.org/way/282713325) | — | — | 0% | 0% |
| 54 | 3590 | [way/1207608184](https://www.openstreetmap.org/way/1207608184) | — | — | 0% | 0% |
| 55 | 3592 | [way/415939084](https://www.openstreetmap.org/way/415939084) | — | — | 0% | 0% |
| 56 | 3707 | [way/337364744](https://www.openstreetmap.org/way/337364744) | — | — | 0% | 0% |
| 57 | 3735 | [way/591365819](https://www.openstreetmap.org/way/591365819) | osm-591365819 | 185.881654 м² | 100.00000000% | 100.00000000% |
| 58 | 3742 | [way/284620213](https://www.openstreetmap.org/way/284620213) | — | — | 0% | 0% |
| 59 | 3756 | [way/1207148736](https://www.openstreetmap.org/way/1207148736) | — | — | 0% | 0% |
| 60 | 3757 | [way/373390884](https://www.openstreetmap.org/way/373390884) | — | — | 0% | 0% |
| 61 | 3758 | [way/75311175](https://www.openstreetmap.org/way/75311175) | — | — | 0% | 0% |
| 62 | 3760 | [way/65275424](https://www.openstreetmap.org/way/65275424) | — | — | 0% | 0% |
| 63 | 3777 | [way/73485191](https://www.openstreetmap.org/way/73485191) | — | — | 0% | 0% |
| 64 | 3787 | [way/1206434174](https://www.openstreetmap.org/way/1206434174) | — | — | 0% | 0% |
| 65 | 3823 | [way/188447905](https://www.openstreetmap.org/way/188447905) | — | — | 0% | 0% |
| 66 | 3878 | [way/1172799960](https://www.openstreetmap.org/way/1172799960) | osm-75312921 | 0.000010 м² | 0.00000111% | 0.00000046% |
| 67 | 3886 | [way/549425978](https://www.openstreetmap.org/way/549425978) | — | — | 0% | 0% |
| 68 | 3905 | [way/1426901042](https://www.openstreetmap.org/way/1426901042) | — | — | 0% | 0% |
| 69 | 3957 | [way/282242687](https://www.openstreetmap.org/way/282242687) | — | — | 0% | 0% |
| 70 | 4028 | [way/142657226](https://www.openstreetmap.org/way/142657226) | — | — | 0% | 0% |
| 71 | 4030 | [way/1172799959](https://www.openstreetmap.org/way/1172799959) | osm-75312921 | 0.232830 м² | 0.02028348% | 0.01096185% |
| 72 | 4033 | [way/1193859179](https://www.openstreetmap.org/way/1193859179) | — | — | 0% | 0% |
| 73 | 4070 | [way/337269648](https://www.openstreetmap.org/way/337269648) | — | — | 0% | 0% |
| 74 | 4079 | [way/75316066](https://www.openstreetmap.org/way/75316066) | — | — | 0% | 0% |
| 75 | 4157 | [way/1373529138](https://www.openstreetmap.org/way/1373529138) | — | — | 0% | 0% |
| 76 | 4167 | [way/1305830046](https://www.openstreetmap.org/way/1305830046) | osm-555200462 | 0.536729 м² | 0.10749261% | 0.05058416% |
| 77 | 4171 | [way/294982340](https://www.openstreetmap.org/way/294982340) | conservatoire<br>osm-190599810 | 0.321608 м²<br>0.616128 м² | 0.08096352%<br>0.15510757% | 0.01140794%<br>0.09382118% |
| 78 | 4177 | [way/282045909](https://www.openstreetmap.org/way/282045909) | — | — | 0% | 0% |
| 79 | 4185 | [way/1451986805](https://www.openstreetmap.org/way/1451986805) | — | — | 0% | 0% |
| 80 | 4192 | [way/58078961](https://www.openstreetmap.org/way/58078961) | — | — | 0% | 0% |
| 81 | 4209 | [way/174296550](https://www.openstreetmap.org/way/174296550) | — | — | 0% | 0% |
| 82 | 4222 | [way/464080229](https://www.openstreetmap.org/way/464080229) | — | — | 0% | 0% |
| 83 | 4235 | [way/77661969](https://www.openstreetmap.org/way/77661969) | — | — | 0% | 0% |
| 84 | 4239 | [way/56677905](https://www.openstreetmap.org/way/56677905) | — | — | 0% | 0% |
| 85 | 4272 | [way/1206575085](https://www.openstreetmap.org/way/1206575085) | — | — | 0% | 0% |
| 86 | 4273 | [way/142656675](https://www.openstreetmap.org/way/142656675) | — | — | 0% | 0% |
| 87 | 4306 | [way/25699467](https://www.openstreetmap.org/way/25699467) | — | — | 0% | 0% |
| 88 | 4317 | [way/1429048941](https://www.openstreetmap.org/way/1429048941) | — | — | 0% | 0% |
| 89 | 4375 | [way/555200496](https://www.openstreetmap.org/way/555200496) | — | — | 0% | 0% |
| 90 | 4386 | [way/282231532](https://www.openstreetmap.org/way/282231532) | osm-282231514 | касание, 0 м² | 0.00000000% | 0.00000000% |
| 91 | 4414 | [way/198114602](https://www.openstreetmap.org/way/198114602) | — | — | 0% | 0% |
| 92 | 4493 | [way/44709683](https://www.openstreetmap.org/way/44709683) | — | — | 0% | 0% |
| 93 | 4608 | [way/190038732](https://www.openstreetmap.org/way/190038732) | — | — | 0% | 0% |
| 94 | 4641 | [way/25699483](https://www.openstreetmap.org/way/25699483) | — | — | 0% | 0% |
| 95 | 4666 | [way/1159768301](https://www.openstreetmap.org/way/1159768301) | — | — | 0% | 0% |
| 96 | 4668 | [way/78005878](https://www.openstreetmap.org/way/78005878) | — | — | 0% | 0% |
| 97 | 4688 | [way/588856761](https://www.openstreetmap.org/way/588856761) | — | — | 0% | 0% |
| 98 | 4751 | [way/38326853](https://www.openstreetmap.org/way/38326853) | — | — | 0% | 0% |
| 99 | 4800 | [way/190587065](https://www.openstreetmap.org/way/190587065) | — | — | 0% | 0% |
| 100 | 4819 | [way/190475629](https://www.openstreetmap.org/way/190475629) | — | — | 0% | 0% |
| 101 | 4896 | [way/198114600](https://www.openstreetmap.org/way/198114600) | — | — | 0% | 0% |
| 102 | 4944 | [way/1236448832](https://www.openstreetmap.org/way/1236448832) | — | — | 0% | 0% |
| 103 | 4946 | [way/1163438218](https://www.openstreetmap.org/way/1163438218) | — | — | 0% | 0% |
| 104 | 4948 | [way/1163438210](https://www.openstreetmap.org/way/1163438210) | — | — | 0% | 0% |
| 105 | 5000 | [way/34148385](https://www.openstreetmap.org/way/34148385) | — | — | 0% | 0% |
| 106 | 5004 | [way/531596101](https://www.openstreetmap.org/way/531596101) | — | — | 0% | 0% |
| 107 | 5006 | [way/135869289](https://www.openstreetmap.org/way/135869289) | — | — | 0% | 0% |
| 108 | 5007 | [way/415585844](https://www.openstreetmap.org/way/415585844) | — | — | 0% | 0% |
| 109 | 5008 | [way/415585842](https://www.openstreetmap.org/way/415585842) | — | — | 0% | 0% |
| 110 | 5047 | [way/78390490](https://www.openstreetmap.org/way/78390490) | — | — | 0% | 0% |
| 111 | 5208 | [way/76960034](https://www.openstreetmap.org/way/76960034) | — | — | 0% | 0% |
| 112 | 15996 | [way/337421300](https://www.openstreetmap.org/way/337421300) | — | — | 0% | 0% |
| 113 | 16002 | [way/173131485](https://www.openstreetmap.org/way/173131485) | — | — | 0% | 0% |
| 114 | 16003 | [way/189826202](https://www.openstreetmap.org/way/189826202) | — | — | 0% | 0% |
| 115 | 16025 | [way/1246282541](https://www.openstreetmap.org/way/1246282541) | — | — | 0% | 0% |
| 116 | 16047 | [way/337851293](https://www.openstreetmap.org/way/337851293) | osm-1361923567 | 0.061777 м² | 0.01257754% | 0.00436405% |
| 117 | 16052 | [way/1274260082](https://www.openstreetmap.org/way/1274260082) | — | — | 0% | 0% |
| 118 | 16057 | [way/478568522](https://www.openstreetmap.org/way/478568522) | — | — | 0% | 0% |
| 119 | 26717 | [way/641462736](https://www.openstreetmap.org/way/641462736) | — | — | 0% | 0% |
| 120 | 4071 | [way/129840872](https://www.openstreetmap.org/way/129840872) | — | — | 0% | 0% |
| 121 | 4583 | [way/242224841](https://www.openstreetmap.org/way/242224841) | — | — | 0% | 0% |
| 122 | 3347 | [way/1217883895](https://www.openstreetmap.org/way/1217883895) | — | — | 0% | 0% |
| 123 | 3484 | [way/295188423](https://www.openstreetmap.org/way/295188423) | — | — | 0% | 0% |
| 124 | 4016 | [way/1080996079](https://www.openstreetmap.org/way/1080996079) | — | — | 0% | 0% |
| 125 | 4436 | [way/365098623](https://www.openstreetmap.org/way/365098623) | — | — | 0% | 0% |
| 126 | 3099 | [way/1289207833](https://www.openstreetmap.org/way/1289207833) | — | — | 0% | 0% |
| 127 | 3773 | [way/1217883916](https://www.openstreetmap.org/way/1217883916) | — | — | 0% | 0% |
| 128 | 2965 | [way/1365593651](https://www.openstreetmap.org/way/1365593651) | — | — | 0% | 0% |
| 129 | 3377 | [way/143349273](https://www.openstreetmap.org/way/143349273) | — | — | 0% | 0% |
| 130 | 2671 | [way/1225299270](https://www.openstreetmap.org/way/1225299270) | — | — | 0% | 0% |
| 131 | 3326 | [way/78145184](https://www.openstreetmap.org/way/78145184) | — | — | 0% | 0% |
| 132 | 3469 | [way/337365207](https://www.openstreetmap.org/way/337365207) | — | — | 0% | 0% |
| 133 | 4393 | [way/224748690](https://www.openstreetmap.org/way/224748690) | — | — | 0% | 0% |
| 134 | 3362 | [way/220702092](https://www.openstreetmap.org/way/220702092) | — | — | 0% | 0% |
| 135 | 3690 | [way/337364751](https://www.openstreetmap.org/way/337364751) | — | — | 0% | 0% |
| 136 | 2849 | [way/1225299272](https://www.openstreetmap.org/way/1225299272) | — | — | 0% | 0% |
| 137 | 4101 | [way/555200386](https://www.openstreetmap.org/way/555200386) | — | — | 0% | 0% |
| 138 | 3447 | [way/1262673998](https://www.openstreetmap.org/way/1262673998) | — | — | 0% | 0% |
| 139 | 4442 | [way/159818810](https://www.openstreetmap.org/way/159818810) | — | — | 0% | 0% |
| 140 | 3388 | [way/57403663](https://www.openstreetmap.org/way/57403663) | — | — | 0% | 0% |
| 141 | 3336 | [way/1222201489](https://www.openstreetmap.org/way/1222201489) | — | — | 0% | 0% |
| 142 | 3657 | [way/503328572](https://www.openstreetmap.org/way/503328572) | — | — | 0% | 0% |
| 143 | 3847 | [way/337365203](https://www.openstreetmap.org/way/337365203) | — | — | 0% | 0% |
| 144 | 4763 | [way/1234716193](https://www.openstreetmap.org/way/1234716193) | — | — | 0% | 0% |
| 145 | 3339 | [way/123574122](https://www.openstreetmap.org/way/123574122) | — | — | 0% | 0% |
| 146 | 4932 | [way/242179595](https://www.openstreetmap.org/way/242179595) | — | — | 0% | 0% |
| 147 | 3317 | [way/1207173706](https://www.openstreetmap.org/way/1207173706) | — | — | 0% | 0% |
| 148 | 3058 | [way/246785818](https://www.openstreetmap.org/way/246785818) | — | — | 0% | 0% |
| 149 | 4711 | [way/78004768](https://www.openstreetmap.org/way/78004768) | — | — | 0% | 0% |
| 150 | 16022 | [way/1312915852](https://www.openstreetmap.org/way/1312915852) | — | — | 0% | 0% |
| 151 | 3082 | [way/218120847](https://www.openstreetmap.org/way/218120847) | — | — | 0% | 0% |
| 152 | 2888 | [way/1278166560](https://www.openstreetmap.org/way/1278166560) | — | — | 0% | 0% |
| 153 | 2928 | [way/336997938](https://www.openstreetmap.org/way/336997938) | — | — | 0% | 0% |
| 154 | 3723 | [way/680607569](https://www.openstreetmap.org/way/680607569) | — | — | 0% | 0% |
| 155 | 3821 | [way/294971081](https://www.openstreetmap.org/way/294971081) | — | — | 0% | 0% |
| 156 | 3290 | [way/147665174](https://www.openstreetmap.org/way/147665174) | — | — | 0% | 0% |
| 157 | 2713 | [way/1069053608](https://www.openstreetmap.org/way/1069053608) | — | — | 0% | 0% |
| 158 | 3664 | [way/1206434300](https://www.openstreetmap.org/way/1206434300) | — | — | 0% | 0% |
| 159 | 3714 | [way/278885372](https://www.openstreetmap.org/way/278885372) | — | — | 0% | 0% |
| 160 | 4002 | [way/1206434315](https://www.openstreetmap.org/way/1206434315) | — | — | 0% | 0% |
| 161 | 4945 | [way/73412942](https://www.openstreetmap.org/way/73412942) | — | — | 0% | 0% |
| 162 | 2956 | [way/246783230](https://www.openstreetmap.org/way/246783230) | — | — | 0% | 0% |
| 163 | 3135 | [way/1127991564](https://www.openstreetmap.org/way/1127991564) | — | — | 0% | 0% |
| 164 | 2755 | [way/465566841](https://www.openstreetmap.org/way/465566841) | — | — | 0% | 0% |
| 165 | 3626 | [way/549425991](https://www.openstreetmap.org/way/549425991) | — | — | 0% | 0% |
| 166 | 3792 | [way/337432044](https://www.openstreetmap.org/way/337432044) | — | — | 0% | 0% |
| 167 | 4721 | [way/1125012315](https://www.openstreetmap.org/way/1125012315) | — | — | 0% | 0% |
| 168 | 4579 | [way/242179594](https://www.openstreetmap.org/way/242179594) | — | — | 0% | 0% |
| 169 | 3906 | [way/1206434257](https://www.openstreetmap.org/way/1206434257) | — | — | 0% | 0% |
| 170 | 3824 | [way/282034921](https://www.openstreetmap.org/way/282034921) | — | — | 0% | 0% |
| 171 | 3495 | [way/337364748](https://www.openstreetmap.org/way/337364748) | — | — | 0% | 0% |
| 172 | 4162 | [way/1231994177](https://www.openstreetmap.org/way/1231994177) | — | — | 0% | 0% |
| 173 | 3683 | [way/1066392727](https://www.openstreetmap.org/way/1066392727) | — | — | 0% | 0% |
| 174 | 3819 | [way/242191025](https://www.openstreetmap.org/way/242191025) | — | — | 0% | 0% |
| 175 | 3172 | [way/462897307](https://www.openstreetmap.org/way/462897307) | — | — | 0% | 0% |
| 176 | 3319 | [way/733122416](https://www.openstreetmap.org/way/733122416) | — | — | 0% | 0% |
| 177 | 5003 | [way/901102995](https://www.openstreetmap.org/way/901102995) | — | — | 0% | 0% |
| 178 | 3647 | [way/1220380979](https://www.openstreetmap.org/way/1220380979) | — | — | 0% | 0% |
| 179 | 4103 | [way/159818820](https://www.openstreetmap.org/way/159818820) | — | — | 0% | 0% |
| 180 | 4304 | [way/254277285](https://www.openstreetmap.org/way/254277285) | — | — | 0% | 0% |
| 181 | 2864 | [way/1269152262](https://www.openstreetmap.org/way/1269152262) | — | — | 0% | 0% |
| 182 | 4369 | [way/1206575093](https://www.openstreetmap.org/way/1206575093) | osm-555209502 | 0.031517 м² | 0.00305915% | 0.00337565% |
| 183 | 3219 | [way/282471403](https://www.openstreetmap.org/way/282471403) | — | — | 0% | 0% |
| 184 | 4919 | [way/242224837](https://www.openstreetmap.org/way/242224837) | — | — | 0% | 0% |
| 185 | 4761 | [way/77639317](https://www.openstreetmap.org/way/77639317) | — | — | 0% | 0% |
| 186 | 3743 | [way/77899499](https://www.openstreetmap.org/way/77899499) | — | — | 0% | 0% |
| 187 | 3851 | [way/1207148734](https://www.openstreetmap.org/way/1207148734) | — | — | 0% | 0% |
| 188 | 3874 | [way/337365206](https://www.openstreetmap.org/way/337365206) | — | — | 0% | 0% |
| 189 | 3692 | [way/549425902](https://www.openstreetmap.org/way/549425902) | — | — | 0% | 0% |
| 190 | 3550 | [way/1217416149](https://www.openstreetmap.org/way/1217416149) | — | — | 0% | 0% |
| 191 | 3662 | [way/706233174](https://www.openstreetmap.org/way/706233174) | — | — | 0% | 0% |
| 192 | 3751 | [way/1217416151](https://www.openstreetmap.org/way/1217416151) | — | — | 0% | 0% |
| 193 | 5009 | [way/78357093](https://www.openstreetmap.org/way/78357093) | — | — | 0% | 0% |
| 194 | 2792 | [way/375520108](https://www.openstreetmap.org/way/375520108) | — | — | 0% | 0% |
| 195 | 3443 | [way/337364749](https://www.openstreetmap.org/way/337364749) | — | — | 0% | 0% |
| 196 | 3968 | [way/77893810](https://www.openstreetmap.org/way/77893810) | — | — | 0% | 0% |
| 197 | 3315 | [way/282471274](https://www.openstreetmap.org/way/282471274) | — | — | 0% | 0% |
| 198 | 3526 | [way/1207148722](https://www.openstreetmap.org/way/1207148722) | — | — | 0% | 0% |
| 199 | 3005 | [way/132312112](https://www.openstreetmap.org/way/132312112) | — | — | 0% | 0% |
| 200 | 3911 | [way/338830393](https://www.openstreetmap.org/way/338830393) | — | — | 0% | 0% |
