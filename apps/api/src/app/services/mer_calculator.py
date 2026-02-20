"""
MER (Metabolizable Energy Requirement) / RER (Resting Energy Requirement) calculator.

Formula:
  RER = 70 × weight_kg^0.75  (allometric scaling)
  MER = RER × factor_activity × factor_bcs × factor_age × factor_health
            × factor_environment × factor_breed_size × factor_weight_goal

All factor tables are Python dicts – no DB dependency. The function returns
a full transparent snapshot so the UI can show each factor with its label.
"""

from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Factor tables
# ---------------------------------------------------------------------------

# Activity / altered-status factors (dog)
_ACTIVITY_DOG: dict[str, tuple[float, str]] = {
    "intact_baby": (3.0, "Štěně / krmení mlékem"),
    "intact_young": (2.0, "Mladý pes, nekastrovaný"),
    "intact_adult": (1.8, "Dospělý pes, nekastrovaný"),
    "intact_senior": (1.4, "Starší pes, nekastrovaný"),
    "neutered_baby": (3.0, "Štěně / krmení mlékem"),
    "neutered_young": (1.8, "Mladý pes, kastrovaný"),
    "neutered_adult": (1.4, "Dospělý pes, kastrovaný"),
    "neutered_senior": (1.2, "Starší pes, kastrovaný"),
    "spayed_baby": (3.0, "Štěně / krmení mlékem"),
    "spayed_young": (1.8, "Mladá fena, sterilizovaná"),
    "spayed_adult": (1.4, "Dospělá fena, sterilizovaná"),
    "spayed_senior": (1.2, "Starší fena, sterilizovaná"),
    "unknown_baby": (3.0, "Štěně"),
    "unknown_young": (2.0, "Mladý pes"),
    "unknown_adult": (1.6, "Dospělý pes"),
    "unknown_senior": (1.3, "Starší pes"),
}

# Activity / altered-status factors (cat)
_ACTIVITY_CAT: dict[str, tuple[float, str]] = {
    "intact_baby": (2.5, "Koťátko / krmení mlékem"),
    "intact_young": (1.8, "Mladá kočka, nekastrovaná"),
    "intact_adult": (1.4, "Dospělá kočka, nekastrovaná"),
    "intact_senior": (1.1, "Starší kočka, nekastrovaná"),
    "neutered_baby": (2.5, "Koťátko / krmení mlékem"),
    "neutered_young": (1.6, "Mladý kocour, kastrovaný"),
    "neutered_adult": (1.2, "Dospělý kocour, kastrovaný"),
    "neutered_senior": (1.0, "Starší kocour, kastrovaný"),
    "spayed_baby": (2.5, "Koťátko / krmení mlékem"),
    "spayed_young": (1.6, "Mladá kočka, sterilizovaná"),
    "spayed_adult": (1.2, "Dospělá kočka, sterilizovaná"),
    "spayed_senior": (1.0, "Starší kočka, sterilizovaná"),
    "unknown_baby": (2.5, "Koťátko"),
    "unknown_young": (1.7, "Mladá kočka"),
    "unknown_adult": (1.3, "Dospělá kočka"),
    "unknown_senior": (1.0, "Starší kočka"),
}

# BCS factors (Body Condition Score, 1–9 scale)
BCS_FACTORS: dict[int, tuple[float, str]] = {
    1: (1.25, "BCS 1 – těžká podváha (+25 %)"),
    2: (1.20, "BCS 2 – výrazná podváha (+20 %)"),
    3: (1.10, "BCS 3 – mírná podváha (+10 %)"),
    4: (1.00, "BCS 4 – lehce pod ideálem"),
    5: (1.00, "BCS 5 – ideální kondice"),
    6: (0.90, "BCS 6 – lehce nad ideálem (-10 %)"),
    7: (0.85, "BCS 7 – mírná nadváha (-15 %)"),
    8: (0.80, "BCS 8 – obezita (-20 %)"),
    9: (0.75, "BCS 9 – těžká obezita (-25 %)"),
}

# Age-group overrides applied ON TOP of activity factor (multiplied)
# Activity factor already encodes baby/young/adult/senior, so age factor is 1.0
# except for puppies/kittens where gestational phase needs separate boost.
# In practice age is already baked into activity key – keep at 1.0 to avoid double-counting.
AGE_LABELS: dict[str, str] = {
    "baby": "Mládě (do 4 měsíců)",
    "young": "Junior (4–12 měsíců)",
    "adult": "Dospělý (1–7 let)",
    "senior": "Senior (7+ let)",
    "unknown": "Neznámý věk",
}

# Health modifiers
HEALTH_FACTORS: dict[str, tuple[float, str]] = {
    "healthy": (1.00, "Zdravý"),
    "recovery": (1.25, "Rekonvalescence (+25 %)"),
    "critical": (1.50, "Kritický stav (+50 %)"),
    "cancer": (1.35, "Onkologické onemocnění (+35 %)"),
    "obese_program": (0.80, "Redukční program (-20 %)"),
    "kidney_disease": (1.10, "Onemocnění ledvin (+10 %)"),
    "diabetes": (1.00, "Diabetes – bez korekce"),
    "hyperthyroid": (1.10, "Hypertyreóza (+10 %)"),
    "hypothyroid": (0.90, "Hypotyreóza (-10 %)"),
    "pregnant": (1.50, "Březost (+50 %)"),
    "lactating": (2.00, "Laktace (+100 %)"),
}

# Environment factors
ENVIRONMENT_FACTORS: dict[str, tuple[float, str]] = {
    "indoor": (1.00, "Vnitřní prostředí"),
    "outdoor_summer": (1.05, "Venkovní kotec (léto, > 20 °C)"),
    "outdoor_cool": (1.10, "Venkovní kotec (10–20 °C)"),
    "outdoor_winter": (1.20, "Venkovní kotec (zima, < 10 °C)"),
    "outdoor_cold": (1.30, "Venkovní kotec (mráz, < 0 °C)"),
}

# Breed / size category factors
BREED_SIZE_FACTORS: dict[str, tuple[float, str]] = {
    "xs": (0.95, "Trpasličí plemeno (< 4 kg)"),
    "s": (0.98, "Malé plemeno (4–10 kg)"),
    "m": (1.00, "Střední plemeno (10–25 kg)"),
    "l": (1.02, "Velké plemeno (25–45 kg)"),
    "xl": (1.05, "Obří plemeno (> 45 kg)"),
    "unknown": (1.00, "Neznámá velikost"),
}

# Weight-goal factors
WEIGHT_GOAL_FACTORS: dict[str, tuple[float, str]] = {
    "maintain": (1.00, "Udržet váhu"),
    "lose": (0.80, "Redukce váhy (-20 %)"),
    "gain": (1.20, "Přibírání váhy (+20 %)"),
}


# ---------------------------------------------------------------------------
# Calculator
# ---------------------------------------------------------------------------


def calculate_mer(
    weight_kg: float,
    species: str,  # dog / cat / rodent / bird / other
    altered_status: str,  # intact / neutered / spayed / unknown
    age_group: str,  # baby / young / adult / senior / unknown
    bcs: int | None,  # 1–9, None → skip BCS correction
    health_modifier: str,  # healthy / recovery / ...
    environment: str,  # indoor / outdoor_winter / ...
    breed_size: str,  # xs / s / m / l / xl / unknown
    weight_goal: str,  # maintain / lose / gain
    food_kcal_per_100g: float | None = None,
    meals_per_day: int = 2,
) -> dict:
    """
    Returns a full transparent MER snapshot:
    {
        weight_kg, rer, factors: {activity, bcs?, age, health, environment,
                                   breed_size, weight_goal},
        mer_total_factor, mer_kcal, food_recommendation?, calculated_at
    }
    """
    # --- RER ---
    rer = 70.0 * (weight_kg**0.75)

    # --- Activity factor (species + altered_status + age_group) ---
    activity_key = f"{altered_status}_{age_group}"
    if species == "cat":
        activity_entry = (
            _ACTIVITY_CAT.get(activity_key)
            or _ACTIVITY_CAT.get(f"unknown_{age_group}")
            or (1.2, "Kočka")
        )
    else:
        # dog and all other species use dog table as default
        activity_entry = (
            _ACTIVITY_DOG.get(activity_key)
            or _ACTIVITY_DOG.get(f"unknown_{age_group}")
            or (1.4, "Pes")
        )

    activity_val, activity_label = activity_entry

    # --- BCS factor ---
    bcs_factor: dict | None = None
    if bcs is not None and 1 <= bcs <= 9:
        bcs_val, bcs_label = BCS_FACTORS[bcs]
        bcs_factor = {"value": bcs_val, "label": bcs_label}

    # --- Age label (informational – no separate multiplier, baked into activity) ---
    age_label = AGE_LABELS.get(age_group, "Neznámý věk")

    # --- Health modifier ---
    health_val, health_label = HEALTH_FACTORS.get(
        health_modifier, HEALTH_FACTORS["healthy"]
    )

    # --- Environment ---
    env_val, env_label = ENVIRONMENT_FACTORS.get(
        environment, ENVIRONMENT_FACTORS["indoor"]
    )

    # --- Breed size ---
    size_val, size_label = BREED_SIZE_FACTORS.get(
        breed_size, BREED_SIZE_FACTORS["unknown"]
    )

    # --- Weight goal ---
    goal_val, goal_label = WEIGHT_GOAL_FACTORS.get(
        weight_goal, WEIGHT_GOAL_FACTORS["maintain"]
    )

    # --- Total factor and MER ---
    total_factor = activity_val
    if bcs_factor:
        total_factor *= bcs_factor["value"]
    total_factor *= health_val * env_val * size_val * goal_val

    mer_kcal = rer * total_factor

    # --- Food recommendation ---
    food_recommendation = None
    if food_kcal_per_100g and food_kcal_per_100g > 0:
        amount_g_per_day = (mer_kcal / food_kcal_per_100g) * 100
        per_meal = amount_g_per_day / max(meals_per_day, 1)
        food_recommendation = {
            "food_id": None,
            "kcal_per_100g": round(food_kcal_per_100g, 1),
            "amount_g_per_day": round(amount_g_per_day, 1),
            "meals_per_day": meals_per_day,
            "amount_g_per_meal": round(per_meal, 1),
        }

    # --- Build factors dict ---
    factors: dict = {
        "activity": {"value": round(activity_val, 3), "label": activity_label},
        "age": {"value": 1.0, "label": age_label},
        "health": {"value": round(health_val, 3), "label": health_label},
        "environment": {"value": round(env_val, 3), "label": env_label},
        "breed_size": {"value": round(size_val, 3), "label": size_label},
        "weight_goal": {"value": round(goal_val, 3), "label": goal_label},
    }
    if bcs_factor:
        factors["bcs"] = bcs_factor

    return {
        "weight_kg": round(weight_kg, 2),
        "rer": round(rer, 1),
        "factors": factors,
        "mer_total_factor": round(total_factor, 4),
        "mer_kcal": round(mer_kcal, 1),
        "food_recommendation": food_recommendation,
        "calculated_at": datetime.now(timezone.utc).isoformat(),
    }
