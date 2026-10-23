# Teplo reference

`teplo_original.py` is the unmodified numerical module supplied in Teplo.zip.
The browser port is `assets/coil-thermal-method.js`; it is tested against
independently generated Python/CoolProp 8.0.0 values in
`tests/fixtures/teplo-reference.json`.

The fixture suite includes 13 scenarios: defaults, 8+10 coils, both shell
correlation branches, both arrangements, high shell Reynolds, different row tube
diameters, three coils with one turn, short-length correction, a valid turbulent
case, both inlet flow modes, Air/Water and lower temperatures.

The golden fixture tolerance is max(1e-7 absolute, 1e-9 relative), separately for
geometry, properties, temperatures, Q, K, UA, alpha, Nu, Re, corrections and wall
temperatures. Applicability and iteration statuses must also match. The fixed
fixtures require no Python installation to run `npm test`.

To regenerate independently, install the supplied reference dependencies in an
isolated environment (`CoolProp==8.0.0`, numpy), then run
`python tests/reference/generate_fixtures.py`. It prints the fixture JSON to
stdout; it does not read or invoke the JavaScript port.

The supplied teplo_report.txt is NOT a reference: it describes an obsolete
per-row shell correlation and averaged shell Nu, contrary to the supplied
METHODOLOGY.md and current numerical module. The Word source also contains
earlier algorithm descriptions (nearest Re curve and averaging Nu). This port
uses the explicit algorithm in METHODOLOGY.md + the current Python implementation:
two-stage linear interpolation, one common shell correlation and only the tube
alpha averaged by mean-diameter heat-transfer area. It does not assert numerical
identity with the older report or the earlier Word variant.
