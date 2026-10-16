window.FIT_DATA = {
 "version": 1,
 "muscles": [
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "obliques",
  "lower_back",
  "upper_back",
  "chest",
  "shoulders",
  "biceps",
  "triceps",
  "forearms"
 ],
 "exercises": {
  "march_jack": {
   "name": "Pemanasan Seluruh Badan",
   "primary": [
    "quads",
    "calves"
   ],
   "secondary": [
    "shoulders",
    "glutes"
   ],
   "levels": {
    "easy": {
     "name": "Jalan di tempat + putar bahu",
     "met": 2.8
    },
    "normal": {
     "name": "Jumping jack pelan",
     "met": 4.0
    },
    "hard": {
     "name": "Jumping jack",
     "met": 8.0
    }
   }
  },
  "squat": {
   "name": "Squat",
   "primary": [
    "quads",
    "glutes"
   ],
   "secondary": [
    "calves",
    "hamstrings",
    "abs"
   ],
   "levels": {
    "easy": {
     "name": "Duduk-berdiri dari kursi",
     "met": 3.0
    },
    "normal": {
     "name": "Squat + jinjit di atas",
     "met": 4.5
    },
    "hard": {
     "name": "Squat jump (atau squat cepat kalau lutut kurang oke)",
     "met": 8.0
    }
   }
  },
  "pushup": {
   "name": "Dorong (Push-up)",
   "primary": [
    "chest",
    "triceps"
   ],
   "secondary": [
    "shoulders",
    "abs",
    "forearms"
   ],
   "levels": {
    "easy": {
     "name": "Push-up tembok",
     "met": 3.0
    },
    "normal": {
     "name": "Push-up lutut",
     "met": 4.0
    },
    "hard": {
     "name": "Push-up penuh / diamond",
     "met": 6.0
    }
   }
  },
  "back_extension": {
   "name": "Punggung",
   "primary": [
    "lower_back",
    "upper_back"
   ],
   "secondary": [
    "glutes",
    "shoulders"
   ],
   "levels": {
    "easy": {
     "name": "Cat-cow",
     "met": 2.3
    },
    "normal": {
     "name": "Superman + tarik siku (W)",
     "met": 3.0
    },
    "hard": {
     "name": "Superman + W, tahan 3 detik",
     "met": 3.5
    }
   }
  },
  "plank": {
   "name": "Plank",
   "primary": [
    "abs",
    "obliques"
   ],
   "secondary": [
    "shoulders",
    "glutes",
    "forearms"
   ],
   "levels": {
    "easy": {
     "name": "Plank dari lutut",
     "met": 3.0
    },
    "normal": {
     "name": "Plank 20 dtk + side plank 10 dtk per sisi",
     "met": 3.8
    },
    "hard": {
     "name": "Plank shoulder tap",
     "met": 5.0
    }
   }
  },
  "lunge": {
   "name": "Lunge",
   "primary": [
    "quads",
    "hamstrings",
    "glutes"
   ],
   "secondary": [
    "calves",
    "abs"
   ],
   "levels": {
    "easy": {
     "name": "Lunge ke belakang sambil pegang tembok",
     "met": 3.0
    },
    "normal": {
     "name": "Reverse lunge (ganti kaki)",
     "met": 4.0
    },
    "hard": {
     "name": "Reverse lunge + angkat lutut",
     "met": 5.5
    }
   }
  },
  "biceps_iso": {
   "name": "Biseps",
   "primary": [
    "biceps",
    "forearms"
   ],
   "secondary": [
    "shoulders"
   ],
   "levels": {
    "easy": {
     "name": "Curl isometrik: satu tangan menekan, satu menarik",
     "met": 2.5
    },
    "normal": {
     "name": "Curl isometrik 15 dtk per tangan",
     "met": 3.0
    },
    "hard": {
     "name": "Curl pakai dumbbell / botol air",
     "met": 4.0
    }
   }
  },
  "mountain_climber": {
   "name": "Mountain Climber",
   "primary": [
    "abs",
    "quads"
   ],
   "secondary": [
    "shoulders",
    "glutes",
    "obliques"
   ],
   "levels": {
    "easy": {
     "name": "Mountain climber pelan",
     "met": 4.0
    },
    "normal": {
     "name": "Mountain climber",
     "met": 6.0
    },
    "hard": {
     "name": "Mountain climber cepat",
     "met": 8.0
    }
   }
  },
  "side_plank_calf": {
   "name": "Samping + Betis",
   "primary": [
    "obliques",
    "calves"
   ],
   "secondary": [
    "shoulders",
    "glutes"
   ],
   "levels": {
    "easy": {
     "name": "Side plank lutut",
     "met": 3.0
    },
    "normal": {
     "name": "Side plank 20 dtk per sisi",
     "met": 3.8
    },
    "hard": {
     "name": "Side plank + calf raise bergantian",
     "met": 4.5
    }
   }
  },
  "stretch": {
   "name": "Peregangan Penutup",
   "primary": [
    "hamstrings",
    "obliques",
    "shoulders",
    "lower_back"
   ],
   "secondary": [],
   "levels": {
    "easy": {
     "name": "Tangan ke atas, condong kiri-kanan, sentuh kaki",
     "met": 2.3
    },
    "normal": {
     "name": "Tangan ke atas, condong kiri-kanan, sentuh kaki",
     "met": 2.3
    },
    "hard": {
     "name": "Peregangan penuh (hamstring, pinggang, bahu)",
     "met": 2.3
    }
   }
  }
 },
 "routines": {
  "ringan": {
   "name": "Ringan Banget (Lagi Males)",
   "tagline": "Yang penting gerak",
   "rounds": 1,
   "rest_sec": 0,
   "steps": [
    {
     "exercise": "march_jack",
     "level": "easy",
     "sec": 30
    },
    {
     "exercise": "squat",
     "level": "easy",
     "sec": 30
    },
    {
     "exercise": "pushup",
     "level": "easy",
     "sec": 30
    },
    {
     "exercise": "back_extension",
     "level": "easy",
     "sec": 30
    },
    {
     "exercise": "biceps_iso",
     "level": "easy",
     "sec": 30
    },
    {
     "exercise": "stretch",
     "level": "easy",
     "sec": 30
    }
   ]
  },
  "normal": {
   "name": "Normal",
   "tagline": "Menu pagi harian",
   "rounds": 1,
   "rest_sec": 10,
   "steps": [
    {
     "exercise": "march_jack",
     "level": "normal",
     "sec": 40
    },
    {
     "exercise": "squat",
     "level": "normal",
     "sec": 40
    },
    {
     "exercise": "pushup",
     "level": "normal",
     "sec": 40
    },
    {
     "exercise": "back_extension",
     "level": "normal",
     "sec": 40
    },
    {
     "exercise": "plank",
     "level": "normal",
     "sec": 40
    },
    {
     "exercise": "lunge",
     "level": "normal",
     "sec": 40
    },
    {
     "exercise": "biceps_iso",
     "level": "normal",
     "sec": 40
    },
    {
     "exercise": "stretch",
     "level": "normal",
     "sec": 30
    }
   ]
  },
  "berat": {
   "name": "Berat (Lagi Semangat)",
   "tagline": "2 putaran, full tenaga",
   "rounds": 2,
   "rest_sec": 20,
   "warmup": [
    {
     "exercise": "march_jack",
     "level": "normal",
     "sec": 120
    }
   ],
   "steps": [
    {
     "exercise": "march_jack",
     "level": "hard",
     "sec": 40
    },
    {
     "exercise": "squat",
     "level": "hard",
     "sec": 40
    },
    {
     "exercise": "pushup",
     "level": "hard",
     "sec": 40
    },
    {
     "exercise": "lunge",
     "level": "hard",
     "sec": 40
    },
    {
     "exercise": "back_extension",
     "level": "hard",
     "sec": 40
    },
    {
     "exercise": "plank",
     "level": "hard",
     "sec": 40
    },
    {
     "exercise": "mountain_climber",
     "level": "hard",
     "sec": 40
    },
    {
     "exercise": "side_plank_calf",
     "level": "hard",
     "sec": 40
    }
   ],
   "cooldown": [
    {
     "exercise": "biceps_iso",
     "level": "hard",
     "sec": 40
    },
    {
     "exercise": "stretch",
     "level": "hard",
     "sec": 80
    }
   ]
  }
 }
};
