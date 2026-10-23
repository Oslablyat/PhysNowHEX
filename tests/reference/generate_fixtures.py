"""Read-only reference execution of the supplied audited numerical module."""
import sys, json
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
from teplo_original import calculate_heat_exchanger

example={'row_count':2,'shell_inner_diameter_m':.200,'displacer_outer_diameter_m':.060,'coil_rows':[
 {'count':8,'radius_m':.055,'pitch_m':.120,'turns':31,'tube_outer_diameter_m':.014},
 {'count':10,'radius_m':.080,'pitch_m':.140,'turns':31,'tube_outer_diameter_m':.014}]}
cases=[('default',{}),('8+10',example),('crossflow',example|{'volume_flow_cold_m3_h':10}),
 ('staggered',example|{'volume_flow_cold_m3_h':10,'arrangement':'staggered'}),
 ('high-shell-re',{'volume_flow_cold_m3_h':200}),
 ('different-diameters',example|{'shell_inner_diameter_m':.220,'coil_rows':[example['coil_rows'][0],example['coil_rows'][1]|{'tube_outer_diameter_m':.020,'pitch_m':.210}]}),
 ('three-coils-one-turn',{'coil_rows':[{'count':3,'radius_m':.050,'pitch_m':.042,'turns':1,'tube_outer_diameter_m':.014}]}),
 ('short-length',{'coil_rows':[{'count':1,'radius_m':.035,'pitch_m':.014,'turns':1,'tube_outer_diameter_m':.014}],'displacer_outer_diameter_m':.04,'mass_flow_hot_kg_s':.05}),
 ('valid-turbulent',{'mass_flow_hot_kg_s':.3,'volume_flow_cold_m3_h':2}),
 ('volumetric-hot',{'hot_flow_mode':'volume','volume_flow_hot_m3_h':.1}),
 ('mass-cold',{'cold_flow_mode':'mass','mass_flow_cold_kg_s':.2}),
 ('air-water',{'hot_fluid':'Air','mass_flow_hot_kg_s':.002}),
 ('cold-water',{'t_hot_in_c':60,'t_cold_in_c':5,'p_hot_mpa':.2,'p_cold_mpa':.3})]
keys=['t_hot_out_c','t_cold_out_c','heat_duty_w','ua_w_k','overall_u_w_m2k','area_m2','alpha_hot_w_m2k','mass_flow_hot_kg_s','mass_flow_cold_kg_s','volume_flow_hot_inlet_m3_h','volume_flow_cold_inlet_m3_h','hot_velocity_m_s','t_wall_c','heat_balance_error_w','hot_properties','cold_properties','valid','outlet_iterations','wall_iterations']
rowkeys=['row','area_m2','alpha_hot_w_m2k','row_correction','crossflow_tube_count','projection_m2','free_area_m2','height_m']
coilkeys=['row','length_m','area_m2','nu_hot','alpha_hot_w_m2k','re_hot','re_critical','radius_ratio','length_ratio','length_correction','angle_correction','k_linear_w_mk','k_w_m2k','ua_w_k','heat_duty_w','wall_inner_c','wall_outer_c','valid']
fixtures=[]
for name,inputs in cases:
 r=calculate_heat_exchanger(inputs)
 expected={k:r[k] for k in keys}
 expected['shell']={k:v for k,v in r['shell'].items() if k!='checks'}
 expected['rows']=[{k:row[k] for k in rowkeys} for row in r['rows']]
 expected['coils']=[{k:next(c for c in r['coils'] if c['row']==row['row'])[k] for k in coilkeys} for row in r['rows']]
 fixtures.append({'name':name,'inputs':inputs,'expected':expected})
print(json.dumps({'source':'Teplo.zip / heat_exchanger_method.py + CoolProp 8.0.0 (Python); not the obsolete teplo_report.txt','cases':fixtures},ensure_ascii=False,indent=2))
