"""Independently recheck all selected audit geometries using supplied Python Teplo."""
import json, sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).parent / 'reference'))
import CoolProp
from teplo_original import calculate_heat_exchanger

assert CoolProp.__version__ == '8.0.0', CoolProp.__version__
root = Path(__file__).resolve().parents[1]
report_name = sys.argv[1] if len(sys.argv)>1 else 'coil-selection-v8-150.json'
assert Path(report_name).name == report_name and report_name.endswith('.json')
report_path = root / 'docs/audits' / report_name
report = json.loads(report_path.read_text(encoding='utf-8'))
results = []
def verify(case, c, kind='selected'):
    s, t = case['state'], case['target']
    g = c['geometry']
    if report['algorithm'].startswith(('re-stock-inline-', 're-stock-full-height-')):
        first = g['rows'][0]
        assert all(row['count']==first['count'] and abs(row['pitch']-first['pitch'])<1e-7
                   and row.get('phase',0)==first.get('phase',0)
                   and row.get('offset',0)==first.get('offset',0)
                   and row.get('direction','right')==first.get('direction','right') for row in g['rows'])
        if report['algorithm'].startswith('re-stock-full-height-'):
            assert all(row['turns']==first['turns'] and abs(row['turns']*row['pitch']+g['tubeDiameter']-g['height'])<1e-7 for row in g['rows'])
    inp = dict(hot_fluid='Water', cold_fluid='Water', t_hot_in_c=s['thi'],
               t_cold_in_c=s['tci'], p_hot_mpa=s['ph'], p_cold_mpa=s['pc'],
               hot_flow_mode='mass', cold_flow_mode='mass', mass_flow_hot_kg_s=s['mh'],
               mass_flow_cold_kg_s=t['mc'], wall_conductivity_w_mk=s['tube-conductivity'],
               arrangement='inline', row_count=len(g['rows']),
               shell_inner_diameter_m=(g['diameter']-2*g['shellWall'])/1000,
               displacer_outer_diameter_m=g['coreDiameter']/1000,
               tube_outer_diameter_m=g['tubeDiameter']/1000,
               tube_wall_thickness_m=g['tubeWall']/1000,
               coil_rows=[dict(count=r['count'], radius_m=r['diameter']/2000,
                               pitch_m=r['pitch']/1000, turns=r['turns'],
                               tube_outer_diameter_m=g['tubeDiameter']/1000) for r in g['rows']])
    r = calculate_heat_exchanger(inp)
    pairs = {'q': r['heat_duty_kw'], 'hot': r['t_hot_out_c'], 'cold': r['t_cold_out_c'],
             're': r['coils'][0]['re_hot'], 'shellRe': r['shell']['re_cold']}
    errors = {k: abs(v-c[k]) for k,v in pairs.items()}
    assert r['valid'] == c['valid'] == True, case['id']
    for k,v in pairs.items():
        assert errors[k] <= max(1e-7, abs(v)*1e-9), (case['id'], k, errors[k])
    assert t['q']*(1-1e-7) <= r['heat_duty_kw'] <= t['q']*(1.01+1e-9), case['id']
    assert all(15000 <= coil['re_hot'] <= 20000 and 3 < coil['radius_ratio'] < 12 for coil in r['coils'])
    # Outlet bounds are checked separately from duty and source applicability.
    assert s['tho']-.01*(s['thi']-s['tho'])-.01 <= r['t_hot_out_c'] <= s['tho']+.01
    assert s['tco']-.01 <= r['t_cold_out_c'] <= s['tco']+.01*(s['tco']-s['tci'])+.01
    results.append(dict(id=case['id'], kind=kind, errors=errors, valid=r['valid']))

for case in report['cases']:
    if case.get('found'):
        verify(case, case['selected'])
probes_path = root / 'docs/audits/coil-selection-probes.json'
if report_name == 'coil-selection-150.json' and probes_path.exists():
    for probe in json.loads(probes_path.read_text(encoding='utf-8'))['probes']:
        case = next(c for c in report['cases'] if c['id'] == probe['id'])
        for kind in ['afterBudget', 'heightRefinement', 'alternativeN', 'shorterWinner']:
            if probe.get(kind):
                verify(case, probe[kind], kind)
out = dict(source='tests/reference/teplo_original.py', CoolProp=CoolProp.__version__,
           checked=len(results), cases=results)
output_name = 'coil-selection-python.json' if report_name == 'coil-selection-150.json' else report_path.stem+'-python.json'
(root / 'docs/audits' / output_name).write_text(json.dumps(out, indent=2)+'\n', encoding='utf-8')
print(json.dumps(dict(checked=len(results), maxErrors={k:max((c['errors'][k] for c in results),default=0) for k in ['q','hot','cold','re','shellRe']})))
