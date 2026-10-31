# Сопоставление контуров очереди с официальными границами наследия

Срез: 31 октября 2026 года. Исследовательская геометрическая проверка, не кадастровое заключение.

## Метод

Для каждого из 200 `ObjectID` запрошен полигон из официального слоя [границ и карточек памятников](https://memkvidreoba.gov.ge/arcgisch/rest/services/Culture/CulturePortalService/MapServer/4); сопоставлен с OSM way из [очереди](research-next-200.md) и локального набора контуров. Для пары посчитаны IoU (площадь пересечения / площадь объединения), доля OSM-контура внутри границы памятника и доля границы, покрытая OSM-контуром. Геометрии сравнивались в WGS84, поэтому проценты округлены; для компактной территории Тбилиси это годится как отбор для ручной проверки.

Совпадение границ может означать, что полигон реестра описывает участок, ансамбль или несколько строений. Высокий IoU помогает найти правильное местоположение, но сам по себе не подтверждает, какой именно корпус охраняется, архитектурный интерес или состояние здания. Используйте таблицу вместе с именами/адресами, источниками истории и визуальной проверкой.

## Результат

Получены геометрии для всех 200 объектов. IoU не ниже 0,70 у 118; 0,25–0,70 у 59; ниже 0,25 у 23. Из 133 пока не добавленных кандидатов: 67 с IoU ≥0,70, 43 со средним перекрытием и 23 с низким.

### Низкое перекрытие: сначала проверить идентичность и геометрию

| № | ID реестра | OSM | IoU | OSM в границе | граница в OSM |
|---:|---:|---|---:|---:|---:|
| 22 | 3175 | [OSM way/1218781712](https://www.openstreetmap.org/way/1218781712) | 0.01 | 0.03 | 0.03 |
| 26 | 3193 | [OSM way/555413425](https://www.openstreetmap.org/way/555413425) | 0.04 | 0.44 | 0.04 |
| 52 | 3540 | [OSM way/198125060](https://www.openstreetmap.org/way/198125060) | 0.00 | 0.00 | 0.00 |
| 59 | 3756 | [OSM way/1207148736](https://www.openstreetmap.org/way/1207148736) | 0.06 | 0.24 | 0.07 |
| 68 | 3905 | [OSM way/1426901042](https://www.openstreetmap.org/way/1426901042) | 0.00 | 0.00 | 0.00 |
| 69 | 3957 | [OSM way/282242687](https://www.openstreetmap.org/way/282242687) | 0.11 | 0.12 | 0.52 |
| 71 | 4030 | [OSM way/1172799959](https://www.openstreetmap.org/way/1172799959) | 0.24 | 0.24 | 1.00 |
| 77 | 4171 | [OSM way/294982340](https://www.openstreetmap.org/way/294982340) | 0.00 | 0.00 | 0.00 |
| 97 | 4688 | [OSM way/588856761](https://www.openstreetmap.org/way/588856761) | 0.00 | 0.00 | 0.00 |
| 112 | 15996 | [OSM way/337421300](https://www.openstreetmap.org/way/337421300) | 0.08 | 0.08 | 1.00 |
| 113 | 16002 | [OSM way/173131485](https://www.openstreetmap.org/way/173131485) | 0.06 | 0.06 | 1.00 |
| 114 | 16003 | [OSM way/189826202](https://www.openstreetmap.org/way/189826202) | 0.09 | 0.95 | 0.09 |
| 115 | 16025 | [OSM way/1246282541](https://www.openstreetmap.org/way/1246282541) | 0.05 | 0.05 | 0.99 |
| 116 | 16047 | [OSM way/337851293](https://www.openstreetmap.org/way/337851293) | 0.16 | 0.16 | 1.00 |
| 121 | 4583 | [OSM way/242224841](https://www.openstreetmap.org/way/242224841) | 0.18 | 0.23 | 0.46 |
| 150 | 16022 | [OSM way/1312915852](https://www.openstreetmap.org/way/1312915852) | 0.10 | 0.10 | 1.00 |
| 158 | 3664 | [OSM way/1206434300](https://www.openstreetmap.org/way/1206434300) | 0.10 | 0.12 | 0.43 |
| 160 | 4002 | [OSM way/1206434315](https://www.openstreetmap.org/way/1206434315) | 0.09 | 0.29 | 0.11 |
| 162 | 2956 | [OSM way/246783230](https://www.openstreetmap.org/way/246783230) | 0.01 | 0.36 | 0.01 |
| 171 | 3495 | [OSM way/337364748](https://www.openstreetmap.org/way/337364748) | 0.06 | 0.06 | 0.69 |
| 187 | 3851 | [OSM way/1207148734](https://www.openstreetmap.org/way/1207148734) | 0.00 | 0.03 | 0.00 |
| 195 | 3443 | [OSM way/337364749](https://www.openstreetmap.org/way/337364749) | 0.12 | 0.13 | 0.77 |
| 198 | 3526 | [OSM way/1207148722](https://www.openstreetmap.org/way/1207148722) | 0.00 | 0.01 | 0.01 |

### Среднее перекрытие: проверить участок, состав объекта и точность контуров

| № | ID реестра | OSM | IoU | OSM в границе | граница в OSM |
|---:|---:|---|---:|---:|---:|
| 1 | 2676 | [OSM way/1157284971](https://www.openstreetmap.org/way/1157284971) | 0.65 | 0.69 | 0.92 |
| 2 | 2684 | [OSM way/1278166606](https://www.openstreetmap.org/way/1278166606) | 0.27 | 0.28 | 0.87 |
| 4 | 2764 | [OSM way/78500061](https://www.openstreetmap.org/way/78500061) | 0.69 | 0.76 | 0.89 |
| 12 | 2991 | [OSM way/337421240](https://www.openstreetmap.org/way/337421240) | 0.51 | 0.51 | 1.00 |
| 14 | 3040 | [OSM way/1484742676](https://www.openstreetmap.org/way/1484742676) | 0.52 | 0.94 | 0.54 |
| 24 | 3187 | [OSM way/1188424739](https://www.openstreetmap.org/way/1188424739) | 0.60 | 0.61 | 0.97 |
| 25 | 3190 | [OSM way/1188424740](https://www.openstreetmap.org/way/1188424740) | 0.32 | 0.33 | 0.86 |
| 27 | 3227 | [OSM way/282713323](https://www.openstreetmap.org/way/282713323) | 0.65 | 0.65 | 1.00 |
| 28 | 3229 | [OSM way/57037626](https://www.openstreetmap.org/way/57037626) | 0.45 | 0.49 | 0.86 |
| 35 | 3321 | [OSM way/462897300](https://www.openstreetmap.org/way/462897300) | 0.56 | 0.95 | 0.58 |
| 43 | 3432 | [OSM way/198140489](https://www.openstreetmap.org/way/198140489) | 0.64 | 0.93 | 0.67 |
| 44 | 3435 | [OSM way/417693230](https://www.openstreetmap.org/way/417693230) | 0.52 | 0.56 | 0.90 |
| 46 | 3466 | [OSM way/549065841](https://www.openstreetmap.org/way/549065841) | 0.63 | 0.92 | 0.67 |
| 48 | 3505 | [OSM way/370845143](https://www.openstreetmap.org/way/370845143) | 0.36 | 0.95 | 0.37 |
| 50 | 3512 | [OSM way/1206434249](https://www.openstreetmap.org/way/1206434249) | 0.29 | 0.66 | 0.35 |
| 57 | 3735 | [OSM way/591365819](https://www.openstreetmap.org/way/591365819) | 0.59 | 0.72 | 0.77 |
| 62 | 3760 | [OSM way/65275424](https://www.openstreetmap.org/way/65275424) | 0.66 | 0.78 | 0.81 |
| 65 | 3823 | [OSM way/188447905](https://www.openstreetmap.org/way/188447905) | 0.59 | 0.96 | 0.61 |
| 74 | 4079 | [OSM way/75316066](https://www.openstreetmap.org/way/75316066) | 0.53 | 0.60 | 0.81 |
| 75 | 4157 | [OSM way/1373529138](https://www.openstreetmap.org/way/1373529138) | 0.46 | 0.46 | 1.00 |
| 78 | 4177 | [OSM way/282045909](https://www.openstreetmap.org/way/282045909) | 0.44 | 0.45 | 0.99 |
| 82 | 4222 | [OSM way/464080229](https://www.openstreetmap.org/way/464080229) | 0.69 | 0.74 | 0.91 |
| 83 | 4235 | [OSM way/77661969](https://www.openstreetmap.org/way/77661969) | 0.59 | 0.98 | 0.59 |
| 85 | 4272 | [OSM way/1206575085](https://www.openstreetmap.org/way/1206575085) | 0.69 | 0.70 | 0.97 |
| 91 | 4414 | [OSM way/198114602](https://www.openstreetmap.org/way/198114602) | 0.64 | 0.68 | 0.92 |
| 96 | 4668 | [OSM way/78005878](https://www.openstreetmap.org/way/78005878) | 0.50 | 0.50 | 1.00 |
| 99 | 4800 | [OSM way/190587065](https://www.openstreetmap.org/way/190587065) | 0.65 | 0.76 | 0.81 |
| 100 | 4819 | [OSM way/190475629](https://www.openstreetmap.org/way/190475629) | 0.57 | 0.87 | 0.62 |
| 101 | 4896 | [OSM way/198114600](https://www.openstreetmap.org/way/198114600) | 0.60 | 0.77 | 0.73 |
| 102 | 4944 | [OSM way/1236448832](https://www.openstreetmap.org/way/1236448832) | 0.69 | 0.85 | 0.79 |
| 103 | 4946 | [OSM way/1163438218](https://www.openstreetmap.org/way/1163438218) | 0.34 | 0.36 | 0.85 |
| 117 | 16052 | [OSM way/1274260082](https://www.openstreetmap.org/way/1274260082) | 0.42 | 1.00 | 0.42 |
| 118 | 16057 | [OSM way/478568522](https://www.openstreetmap.org/way/478568522) | 0.37 | 0.41 | 0.81 |
| 119 | 26717 | [OSM way/641462736](https://www.openstreetmap.org/way/641462736) | 0.49 | 0.70 | 0.62 |
| 124 | 4016 | [OSM way/1080996079](https://www.openstreetmap.org/way/1080996079) | 0.40 | 0.40 | 1.00 |
| 126 | 3099 | [OSM way/1289207833](https://www.openstreetmap.org/way/1289207833) | 0.55 | 0.79 | 0.65 |
| 127 | 3773 | [OSM way/1217883916](https://www.openstreetmap.org/way/1217883916) | 0.63 | 0.91 | 0.68 |
| 128 | 2965 | [OSM way/1365593651](https://www.openstreetmap.org/way/1365593651) | 0.67 | 0.94 | 0.70 |
| 129 | 3377 | [OSM way/143349273](https://www.openstreetmap.org/way/143349273) | 0.68 | 0.68 | 0.99 |
| 130 | 2671 | [OSM way/1225299270](https://www.openstreetmap.org/way/1225299270) | 0.37 | 0.37 | 0.99 |
| 133 | 4393 | [OSM way/224748690](https://www.openstreetmap.org/way/224748690) | 0.69 | 0.72 | 0.96 |
| 136 | 2849 | [OSM way/1225299272](https://www.openstreetmap.org/way/1225299272) | 0.57 | 0.60 | 0.93 |
| 146 | 4932 | [OSM way/242179595](https://www.openstreetmap.org/way/242179595) | 0.55 | 0.62 | 0.83 |
| 147 | 3317 | [OSM way/1207173706](https://www.openstreetmap.org/way/1207173706) | 0.29 | 0.35 | 0.59 |
| 157 | 2713 | [OSM way/1069053608](https://www.openstreetmap.org/way/1069053608) | 0.42 | 0.56 | 0.64 |
| 159 | 3714 | [OSM way/278885372](https://www.openstreetmap.org/way/278885372) | 0.65 | 0.86 | 0.73 |
| 166 | 3792 | [OSM way/337432044](https://www.openstreetmap.org/way/337432044) | 0.49 | 0.49 | 1.00 |
| 168 | 4579 | [OSM way/242179594](https://www.openstreetmap.org/way/242179594) | 0.62 | 0.62 | 0.99 |
| 169 | 3906 | [OSM way/1206434257](https://www.openstreetmap.org/way/1206434257) | 0.57 | 0.69 | 0.76 |
| 170 | 3824 | [OSM way/282034921](https://www.openstreetmap.org/way/282034921) | 0.59 | 0.61 | 0.96 |
| 174 | 3819 | [OSM way/242191025](https://www.openstreetmap.org/way/242191025) | 0.67 | 0.74 | 0.88 |
| 176 | 3319 | [OSM way/733122416](https://www.openstreetmap.org/way/733122416) | 0.43 | 0.50 | 0.75 |
| 177 | 5003 | [OSM way/901102995](https://www.openstreetmap.org/way/901102995) | 0.62 | 0.98 | 0.63 |
| 178 | 3647 | [OSM way/1220380979](https://www.openstreetmap.org/way/1220380979) | 0.55 | 0.67 | 0.75 |
| 180 | 4304 | [OSM way/254277285](https://www.openstreetmap.org/way/254277285) | 0.62 | 0.71 | 0.83 |
| 181 | 2864 | [OSM way/1269152262](https://www.openstreetmap.org/way/1269152262) | 0.55 | 0.55 | 0.98 |
| 189 | 3692 | [OSM way/549425902](https://www.openstreetmap.org/way/549425902) | 0.49 | 1.00 | 0.49 |
| 191 | 3662 | [OSM way/706233174](https://www.openstreetmap.org/way/706233174) | 0.47 | 0.51 | 0.84 |
| 200 | 3911 | [OSM way/338830393](https://www.openstreetmap.org/way/338830393) | 0.43 | 0.53 | 0.68 |

### Высокое перекрытие

Полный список пар с IoU ≥0,70 доступен по исходным строкам очереди и пересчитанному слою. Этот уровень приоритета помогает быстрее проверять кандидатов, но не означает автоматического допуска в атлас.
