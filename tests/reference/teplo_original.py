"""Расчёт теплообменника с параллельными змеевиками в нескольких рядах."""
from __future__ import annotations

from collections import defaultdict
from math import atan, cos, degrees, exp, expm1, isfinite, log, pi, sin, sqrt
from typing import Any

import numpy as np
from CoolProp.CoolProp import PropsSI


DEFAULT_INPUT: dict[str, Any] = {
    "hot_fluid": "Water", "cold_fluid": "Water",
    "t_hot_in_c": 105.0, "t_cold_in_c": 30.0,
    "p_hot_mpa": 1.101, "p_cold_mpa": 0.501,
    "mass_flow_hot_kg_s": 0.02175, "volume_flow_cold_m3_h": 0.7,
    "tube_outer_diameter_m": 0.014, "tube_wall_thickness_m": 0.002,
    "wall_conductivity_w_mk": 16.0,
    "shell_inner_diameter_m": 0.138, "displacer_outer_diameter_m": 0.076,
    "arrangement": "inline",
    "outlet_tolerance_c": 0.01, "wall_tolerance_c": 0.01,
    "row_count": 1,
    "coil_rows": [{"count": 1, "radius_m": 0.050, "pitch_m": 0.021,
                   "turns": 31, "tube_outer_diameter_m": 0.014}],
}
ANGLE_X = [10, 20, 30, 40, 50, 60, 70, 80, 90]
ANGLE_Y = [0.42, 0.52, 0.67, 0.78, 0.88, 0.94, 0.98, 1, 1]
LENGTH_X = [1, 2, 5, 10, 20, 30, 40, 50]
RE_X = [1e4, 2.5e4, 1e5, 1e6]
LENGTH_Y = [
    [1.68, 1.50, 1.34, 1.25, 1.15, 1.08, 1.035, 1],
    [1.50, 1.39, 1.27, 1.18, 1.11, 1.06, 1.025, 1],
    [1.35, 1.29, 1.22, 1.15, 1.09, 1.05, 1.020, 1],
    [1.14, 1.12, 1.09, 1.06, 1.04, 1.025, 1.010, 1],
]


def _positive(data: dict[str, Any], key: str) -> float:
    value = float(data[key])
    if not isfinite(value) or value <= 0:
        raise ValueError(f"{key}: требуется положительное конечное число")
    return value


def _properties(fluid: str, temp_c: float, pressure_pa: float) -> dict[str, float]:
    args = ("T", temp_c + 273.15, "P", pressure_pa, fluid)
    return {key: PropsSI(name, *args) for key, name in (
        ("rho", "Dmass"), ("mu", "VISCOSITY"), ("cp", "Cpmass"),
        ("lambda", "CONDUCTIVITY"), ("pr", "PRANDTL"))}


def _inlet_flow(data: dict[str, Any], defaults: dict[str, Any], side: str,
                inlet_density: float) -> tuple[float, float, str]:
    """Массовый и объёмный расходы на входе; расход остаётся массовым далее."""
    mass_key = f"mass_flow_{side}_kg_s"
    volume_key = f"volume_flow_{side}_m3_h"
    explicit_mass = mass_key in data and data[mass_key] is not None
    explicit_volume = volume_key in data and data[volume_key] is not None
    selected_mode = data.get(f"{side}_flow_mode")
    if selected_mode is None:
        if explicit_mass and explicit_volume:
            raise ValueError(f"{side}: задайте только один вид расхода или явно укажите режим")
        selected_mode = ("mass" if explicit_mass else "volume" if explicit_volume
                         else "mass" if side == "hot" else "volume")
    if selected_mode == "mass":
        if mass_key not in defaults:
            raise ValueError(f"{side}: укажите массовый расход в кг/с")
        mass_flow = _positive(defaults, mass_key)
        volume_flow = mass_flow / inlet_density * 3600
    elif selected_mode == "volume":
        if volume_key not in defaults:
            raise ValueError(f"{side}: укажите объёмный расход в м³/ч")
        volume_flow = _positive(defaults, volume_key)
        mass_flow = volume_flow / 3600 * inlet_density
    else:
        raise ValueError(f"{side}_flow_mode: допустимы mass или volume")
    return mass_flow, volume_flow, selected_mode


def _counterflow_fraction(ua: float, ch: float, cc: float) -> float:
    """Относительное понижение температуры горячего потока."""
    cmin, cmax = min(ch, cc), max(ch, cc)
    ntu, ratio = ua / cmin, cmin / cmax
    if 1 - ratio < 1e-8:
        effectiveness = ntu / (1 + ntu)
    else:
        e = exp(-ntu * (1 - ratio))
        effectiveness = -expm1(-ntu * (1 - ratio)) / (1 - ratio * e)
    return effectiveness * cmin / ch


def _integer(value: Any, label: str) -> int:
    parsed = float(value)
    if not isfinite(parsed) or not parsed.is_integer() or parsed < 1:
        raise ValueError(f"{label}: требуется целое число не меньше 1")
    return int(parsed)


def build_layout(data: dict[str, Any]) -> dict[str, Any]:
    """План входов трубок в поперечном сечении и проверка зазоров.

    Круги в пределах ряда равномерно размещены на одной окружности. Для
    соседних рядов фаза чередуется на половину углового шага.
    """
    d = DEFAULT_INPUT | data
    ds = _positive(d, "shell_inner_diameter_m")
    dd = float(d["displacer_outer_diameter_m"])
    if not isfinite(dd) or not 0 <= dd < ds:
        raise ValueError("Неверный диаметр вытеснителя")
    if "coils" in data:
        groups: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for raw in data["coils"]:
            groups[_integer(raw["row"], "Номер ряда")].append(raw)
        if not groups:
            raise ValueError("Нужен хотя бы один змеевик")
        numbers = sorted(groups)
        if numbers != list(range(1, numbers[-1] + 1)):
            raise ValueError("Номера рядов должны идти подряд от 1")
        specs = []
        for number in numbers:
            members = groups[number]
            radii = {float(c["radius_m"]) for c in members}
            pitches = {float(c["pitch_m"]) for c in members}
            turns = {float(c["turns"]) for c in members}
            diameters = {float(c.get("tube_outer_diameter_m", d["tube_outer_diameter_m"]))
                         for c in members}
            if any(len(values) != 1 for values in (radii, pitches, turns, diameters)):
                raise ValueError(f"Ряд {number}: все змеевики должны иметь одинаковые R, h, витки и диаметр")
            specs.append({"count": len(members), "radius_m": members[0]["radius_m"],
                          "pitch_m": members[0]["pitch_m"], "turns": members[0]["turns"],
                          "tube_outer_diameter_m": next(iter(diameters))})
    else:
        specs = d["coil_rows"]
        if not isinstance(specs, list):
            raise ValueError("coil_rows должен быть списком рядов")
        if len(specs) != _integer(d["row_count"], "Количество рядов"):
            raise ValueError("Количество строк рядов не совпадает с заданным числом рядов")
    if sum(_integer(spec["count"], "Количество змеевиков в ряду") for spec in specs) > 500:
        raise ValueError("Допускается не более 500 змеевиков")

    coils: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    errors: list[str] = []
    for row_number, spec in enumerate(specs, 1):
        count = _integer(spec["count"], f"Ряд {row_number}: количество змеевиков")
        radius, pitch = float(spec["radius_m"]), float(spec["pitch_m"])
        do = _positive({"tube_outer_diameter_m": spec.get(
            "tube_outer_diameter_m", d["tube_outer_diameter_m"])}, "tube_outer_diameter_m")
        turns = _integer(spec["turns"], f"Ряд {row_number}: количество витков")
        if not all(map(isfinite, (radius, pitch))) or radius <= 0 or pitch <= 0:
            raise ValueError(f"Ряд {row_number}: радиус и шаг должны быть положительными")
        required_pitch = count * do
        pitch_margin = pitch - required_pitch
        if pitch_margin < -1e-12:
            errors.append(f"Ряд {row_number}: шаг h={pitch:.5f} м < Nзм*dзм="
                          f"{required_pitch:.5f} м ({count} змеевиков, dзм={do:.5f} м)")
        phase = 0.0 if row_number % 2 else pi / count
        edge_to_displacer = radius - do / 2 - dd / 2
        edge_to_shell = ds / 2 - radius - do / 2
        if edge_to_displacer <= 0:
            errors.append(f"Ряд {row_number}: трубки пересекают вытеснитель")
        if edge_to_shell <= 0:
            errors.append(f"Ряд {row_number}: трубки пересекают кожух")
        center_step = 2 * radius * sin(pi / count) if count > 1 else None
        edge_gap = center_step - do if center_step is not None else None
        if edge_gap is not None and edge_gap < -1e-12:
            errors.append(f"Ряд {row_number}: входы соседних змеевиков пересекаются "
                          f"на {-edge_gap:.5f} м")
        first_index = len(coils) + 1
        for position in range(count):
            theta = phase + 2 * pi * position / count
            coils.append({
                "index": len(coils) + 1, "row": row_number,
                "position": position + 1, "theta_deg": degrees(theta) % 360,
                "x_m": radius * cos(theta), "y_m": radius * sin(theta),
                "radius_m": radius, "pitch_m": pitch, "turns": turns,
                "tube_outer_diameter_m": do,
            })
        rows.append({
            "row": row_number, "coil_count": count, "radius_m": radius,
            "pitch_m": pitch, "turns": turns, "phase_deg": degrees(phase),
            "height_m": turns * pitch,
            "tube_outer_diameter_m": do, "required_pitch_m": required_pitch,
            "pitch_margin_m": pitch_margin,
            "first_coil_index": first_index, "center_step_m": center_step,
            "edge_gap_m": edge_gap, "displacer_gap_m": edge_to_displacer,
            "shell_gap_m": edge_to_shell,
        })
    between_rows = []
    for a in range(len(rows)):
        for b in range(a + 1, len(rows)):
            inner, outer = rows[a], rows[b]
            radial_gap = (abs(inner["radius_m"] - outer["radius_m"])
                          - (inner["tube_outer_diameter_m"]
                             + outer["tube_outer_diameter_m"]) / 2)
            pair = {"row_a": inner["row"], "row_b": outer["row"],
                    "radial_gap_m": radial_gap}
            between_rows.append(pair)
            if radial_gap < -1e-12:
                errors.append(
                    f"Ряды {inner['row']} и {outer['row']}: радиальные зоны трубок "
                    f"пересекаются на {-radial_gap:.4f} м; измените радиусы"
                )
    annulus = pi * (ds**2 - dd**2) / 4
    for row in rows:
        radius = row["radius_m"]
        do = row["tube_outer_diameter_m"]
        # Змеевики одного радиуса делят одну кольцевую полосу проекции,
        # поэтому её площадь не умножается на число входных трубок.
        projection = pi * ((radius + do / 2)**2 - (radius - do / 2)**2)
        row["projection_m2"] = projection
        row["free_area_m2"] = annulus - projection
        if row["free_area_m2"] <= 0:
            errors.append(f"Ряд {row['row']}: свободное сечение неположительно")
    return {"coils": coils, "rows": rows, "between_rows": between_rows,
            "annulus_area_m2": annulus, "errors": errors,
            "shell_diameter_m": ds, "displacer_diameter_m": dd}


def calculate_heat_exchanger(data: dict[str, Any]) -> dict[str, Any]:
    """Вернуть расчёт, отдельные результаты и проверки для каждого змеевика.

    По трубной стороне змеевики параллельны, расход делится поровну.
    Межтрубный поток проходит ряды последовательно. Сечение вычисляется
    для каждого ряда по одной кольцевой полосе проекции, а для общего
    расчёта потока берётся минимальное сечение сборки.
    """
    d = DEFAULT_INPUT | data
    t_hi, t_ci = float(d["t_hot_in_c"]), float(d["t_cold_in_c"])
    if not all(map(isfinite, (t_hi, t_ci))) or t_hi <= t_ci:
        raise ValueError("Горячая входная температура должна быть выше холодной")
    ph, pc = _positive(d, "p_hot_mpa") * 1e6, _positive(d, "p_cold_mpa") * 1e6
    inlet_hot = _properties(str(d["hot_fluid"]), t_hi, ph)
    inlet_cold = _properties(str(d["cold_fluid"]), t_ci, pc)
    gh, vh_in, hot_flow_mode = _inlet_flow(data, d, "hot", inlet_hot["rho"])
    gc, vc_in, cold_flow_mode = _inlet_flow(data, d, "cold", inlet_cold["rho"])
    wall_thickness = _positive(d, "tube_wall_thickness_m")
    lam_wall = _positive(d, "wall_conductivity_w_mk")
    ds = _positive(d, "shell_inner_diameter_m")
    dd = float(d["displacer_outer_diameter_m"])
    if not 0 <= dd < ds:
        raise ValueError("Неверный диаметр вытеснителя")
    arrangement = str(d["arrangement"]).lower()
    if arrangement not in ("inline", "staggered"):
        raise ValueError("Расположение должно быть inline или staggered")
    tol_out = _positive(d, "outlet_tolerance_c")
    tol_wall = _positive(d, "wall_tolerance_c")
    layout = build_layout(data)
    if layout["errors"]:
        raise ValueError("\n".join(layout["errors"]))
    coils: list[dict[str, Any]] = layout["coils"]
    rows: list[dict[str, Any]] = layout["rows"]
    groups: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for coil in coils:
        radius, pitch, turns = coil["radius_m"], coil["pitch_m"], coil["turns"]
        do = coil["tube_outer_diameter_m"]
        di = do - 2 * wall_thickness
        if di <= 0:
            raise ValueError(f"Ряд {coil['row']}: диаметр трубки должен быть больше удвоенной толщины стенки")
        dm = (do + di) / 2
        length = turns * sqrt((2 * pi * radius)**2 + pitch**2)
        angle = degrees(atan(2 * pi * radius / pitch))
        coil.update({
            "tube_inner_diameter_m": di, "tube_mean_diameter_m": dm,
            "tube_flow_area_m2": pi * di**2 / 4,
            "height_m": turns * pitch,
            "length_m": length, "area_m2": pi * dm * length,
            "angle_deg": angle,
            "angle_correction": float(np.interp(angle, ANGLE_X, ANGLE_Y)),
        })
        groups[coil["row"]].append(coil)
    annulus = layout["annulus_area_m2"]
    for row in rows:
        number, count, turns = row["row"], row["coil_count"], row["turns"]
        row["tube_inner_diameter_m"] = groups[number][0]["tube_inner_diameter_m"]
        row["tube_mean_diameter_m"] = groups[number][0]["tube_mean_diameter_m"]
        row["area_m2"] = sum(c["area_m2"] for c in groups[number])
        # Нумеруем трубки поперёк потока, а не витки: первая и вторая
        # получают поправку, для всех последующих она равна единице.
        tube_count = count * turns
        first_count = 1
        second_count = int(tube_count >= 2)
        remaining_count = max(tube_count - 2, 0)
        second_correction = 0.9 if arrangement == "inline" else 0.7
        row["crossflow_tube_count"] = tube_count
        row["first_tube_count"] = first_count
        row["second_tube_count"] = second_count
        row["remaining_tube_count"] = remaining_count
        row["second_tube_correction"] = second_correction
        row["row_correction"] = (
            0.6 * first_count + second_correction * second_count + remaining_count
        ) / tube_count
    total_area = sum(c["area_m2"] for c in coils)
    ordered_rows = sorted(rows, key=lambda item: item["radius_m"])
    radial_steps = [ordered_rows[index + 1]["radius_m"] - ordered_rows[index]["radius_m"]
                    for index in range(len(ordered_rows) - 1)]
    winding_steps = [row["pitch_m"] for row in rows]
    s1 = sum(radial_steps) / len(radial_steps) if radial_steps else None
    s2 = sum(winding_steps) / len(winding_steps)
    ratio = s1 / s2 if s1 is not None and s2 is not None else None
    spacing_correction = (1.0 if ratio is None else
                          ratio**0.15 if arrangement == "inline" else
                          1.0 if ratio < 2 else ratio**0.167)
    shell = {
        "free_area_m2": min(row["free_area_m2"] for row in rows),
        "limiting_row": min(rows, key=lambda row: row["free_area_m2"])["row"],
        "diameter_effective_m": sum(row["tube_outer_diameter_m"] for row in rows) / len(rows),
        "s1_m": s1, "s2_m": s2,
        "row_winding_steps_m": winding_steps,
        "adjacent_radius_steps_m": radial_steps,
        "relative_pitch": ratio, "spacing_correction": spacing_correction,
    }
    shell["bundle_correction"] = sum(
        coil["area_m2"] * rows[coil["row"] - 1]["row_correction"]
        * coil["angle_correction"] for coil in coils
    ) / total_area
    t_ho, t_co = t_hi, t_ci
    for outer_iteration in range(1, 201):
        thm, tcm = (t_hi + t_ho) / 2, (t_ci + t_co) / 2
        hot = _properties(str(d["hot_fluid"]), thm, ph)
        cold = _properties(str(d["cold_fluid"]), tcm, pc)
        vc = gc / cold["rho"]
        ch, cc = gh * hot["cp"], gc * cold["cp"]
        tube_area = sum(c["tube_flow_area_m2"] for c in coils)
        wh = gh / (hot["rho"] * tube_area)
        shell["volume_flow_mean_m3_h"] = vc * 3600
        shell["velocity_m_s"] = vc / shell["free_area_m2"]
        shell["re_cold"] = (cold["rho"] * shell["velocity_m_s"]
                            * shell["diameter_effective_m"] / cold["mu"])
        shell["regime"] = "laminar" if shell["re_cold"] < 1000 else "crossflow"
        for coil in coils:
            di = coil["tube_inner_diameter_m"]
            coil["hot_mass_flow_kg_s"] = gh / len(coils)
            coil["hot_velocity_m_s"] = (coil["hot_mass_flow_kg_s"]
                                        / (hot["rho"] * coil["tube_flow_area_m2"]))
            reh = hot["rho"] * coil["hot_velocity_m_s"] * di / hot["mu"]
            coil["re_hot"] = reh
            coil["re_critical"] = 2300 + 10500 * (di / coil["radius_m"])**0.3
            coil["radius_ratio"] = coil["radius_m"] / di
            ratio = coil["length_m"] / di
            coil["length_ratio"] = ratio
            curve_values = [float(np.interp(ratio, LENGTH_X, curve)) for curve in LENGTH_Y]
            coil["length_correction"] = float(np.interp(reh, RE_X, curve_values))
        wall = (thm + tcm) / 2
        for wall_iteration in range(1, 201):
            prhw = PropsSI("PRANDTL", "T", wall + 273.15, "P", ph, str(d["hot_fluid"]))
            prcw = PropsSI("PRANDTL", "T", wall + 273.15, "P", pc, str(d["cold_fluid"]))
            eh = (hot["pr"] / prhw)**0.25
            ec = (cold["pr"] / prcw)**0.25
            re = shell["re_cold"]
            if re < 1000:
                coefficient, power, pr_power = 0.56, 0.5, 0.36
            else:
                coefficient, power = ((0.26, 0.65) if arrangement == "inline"
                                      else (0.41, 0.6))
                pr_power = 0.33
            shell["correlation_c"] = coefficient
            shell["re_exponent"] = power
            shell["pr_exponent"] = pr_power
            shell["nu_base"] = coefficient * re**power * cold["pr"]**pr_power * ec
            for coil in coils:
                di = coil["tube_inner_diameter_m"]
                coil["nu_hot"] = (0.021 * coil["re_hot"]**0.8 * hot["pr"]**0.43
                                  * (1 + 1.77 * di / coil["radius_m"])
                                  * coil["length_correction"] * eh)
                coil["alpha_hot_w_m2k"] = coil["nu_hot"] * hot["lambda"] / di
            alpha_hot_average = sum(
                coil["alpha_hot_w_m2k"] * coil["area_m2"] for coil in coils
            ) / total_area
            shell["nu_cold"] = (shell["nu_base"] * shell["bundle_correction"]
                                * (shell["spacing_correction"]
                                   if shell["regime"] == "crossflow" else 1))
            shell["alpha_cold_w_m2k"] = (shell["nu_cold"] * cold["lambda"]
                                         / shell["diameter_effective_m"])
            for coil in coils:
                do, di, dm = (coil["tube_outer_diameter_m"],
                              coil["tube_inner_diameter_m"],
                              coil["tube_mean_diameter_m"])
                coil["k_linear_w_mk"] = pi / (
                    1 / (shell["alpha_cold_w_m2k"] * do)
                    + log(do / di) / (2 * lam_wall)
                    + 1 / (alpha_hot_average * di))
                coil["k_w_m2k"] = coil["k_linear_w_mk"] / (pi * dm)
                coil["ua_w_k"] = coil["k_w_m2k"] * coil["area_m2"]
            ua = sum(c["ua_w_k"] for c in coils)
            phi = _counterflow_fraction(ua, ch, cc)
            new_ho = t_hi - (t_hi - t_ci) * phi
            new_co = t_ci + (t_hi - t_ci) * ch / cc * phi
            duty = ch * (t_hi - new_ho)
            for coil in coils:
                do, di, dm = (coil["tube_outer_diameter_m"],
                              coil["tube_inner_diameter_m"],
                              coil["tube_mean_diameter_m"])
                coil["heat_duty_w"] = duty * coil["ua_w_k"] / ua
                flux = coil["heat_duty_w"] / coil["area_m2"]
                coil["wall_outer_c"] = tcm + flux * dm / (do * shell["alpha_cold_w_m2k"])
                coil["wall_inner_c"] = thm - flux * dm / (di * alpha_hot_average)
                coil["wall_mean_c"] = (coil["wall_outer_c"] + coil["wall_inner_c"]) / 2
            new_wall = sum(c["wall_mean_c"] * c["area_m2"] for c in coils) / total_area
            wall_error = abs(new_wall - wall)
            wall = new_wall
            if wall_error <= tol_wall:
                break
        else:
            raise RuntimeError("Не достигнута сходимость температуры стенки")
        hot_error, cold_error = abs(new_ho - t_ho), abs(new_co - t_co)
        t_ho, t_co = new_ho, new_co
        if hot_error <= tol_out and cold_error <= tol_out:
            break
    else:
        raise RuntimeError("Не достигнута сходимость выходных температур")

    shell["checks"] = ([f"Re межтрубного потока < 100000: "
                        f"Re={shell['re_cold']:.2f} (весь аппарат)"]
                       if shell["re_cold"] >= 1e5 else [])
    shell["valid"] = not shell["checks"]
    for row in rows:
        members = groups[row["row"]]
        row["alpha_hot_w_m2k"] = (sum(c["alpha_hot_w_m2k"] * c["area_m2"]
                                       for c in members) / row["area_m2"])
    for coil in coils:
        tube_checks = []
        if coil["re_hot"] <= coil["re_critical"]:
            tube_checks.append(f"Re трубного потока > Reкр: "
                               f"Re={coil['re_hot']:.2f}, Reкр={coil['re_critical']:.2f}")
        if not 3 < coil["radius_ratio"] < 12:
            tube_checks.append(f"3 < R/d внутреннего диаметра < 12: "
                               f"R/d={coil['radius_ratio']:.4f}")
        if coil["length_ratio"] < 50 and not 1e4 <= coil["re_hot"] <= 1e6:
            tube_checks.append(f"При L/d < 50 нужно 10000 <= Re <= 1000000 "
                               f"для графика поправки длины: "
                               f"L/d={coil['length_ratio']:.2f}, Re={coil['re_hot']:.2f}")
        coil["tube_checks"] = tube_checks
        coil["tube_valid"] = not tube_checks
        coil["checks"] = tube_checks + shell["checks"]
        coil["valid"] = not coil["checks"]
    return {
        "coils": coils, "rows": rows, "shell": shell,
        "between_rows": layout["between_rows"],
        "number_of_coils": len(coils),
        "number_of_rows": len(rows), "area_m2": total_area,
        "tube_flow_area_m2": sum(c["tube_flow_area_m2"] for c in coils),
        "annulus_area_m2": annulus, "t_hot_out_c": t_ho,
        "t_cold_out_c": t_co, "heat_duty_w": duty, "heat_duty_kw": duty / 1000,
        "ua_w_k": ua, "overall_u_w_m2k": ua / total_area,
        "alpha_hot_w_m2k": alpha_hot_average,
        "pr_hot": hot["pr"], "pr_cold": cold["pr"],
        "hot_properties": hot, "cold_properties": cold,
        "temperature_correction_hot": eh, "temperature_correction_cold": ec,
        "mass_flow_hot_kg_s": gh, "mass_flow_cold_kg_s": gc,
        "volume_flow_hot_inlet_m3_h": vh_in,
        "volume_flow_cold_inlet_m3_h": vc_in,
        "volume_flow_cold_mean_m3_h": vc * 3600,
        "hot_flow_mode": hot_flow_mode, "cold_flow_mode": cold_flow_mode,
        "hot_inlet_density_kg_m3": inlet_hot["rho"],
        "cold_inlet_density_kg_m3": inlet_cold["rho"],
        "hot_velocity_m_s": wh,
        "t_hot_mean_c": thm, "t_cold_mean_c": tcm, "t_wall_c": wall,
        "pr_hot_wall": prhw, "pr_cold_wall": prcw, "temperature_function": phi,
        "c_hot_w_k": ch, "c_cold_w_k": cc, "outlet_iterations": outer_iteration,
        "wall_iterations": wall_iteration, "outlet_error_hot_c": hot_error,
        "outlet_error_cold_c": cold_error, "wall_error_c": wall_error,
        "heat_balance_error_w": duty - cc * (t_co - t_ci),
        "valid": all(c["valid"] for c in coils),
    }


if __name__ == "__main__":
    result = calculate_heat_exchanger(DEFAULT_INPUT)
    print(f"Горячий выход: {result['t_hot_out_c']:.3f} °C")
    print(f"Холодный выход: {result['t_cold_out_c']:.3f} °C")
    print(f"Мощность: {result['heat_duty_kw']:.3f} кВт")
    for coil in result["coils"]:
        print(f"Змеевик {coil['index']}, ряд {coil['row']}: "
              f"alpha={coil['alpha_hot_w_m2k']:.1f}; "
              f"{'OK' if coil['valid'] else '; '.join(coil['checks'])}")
