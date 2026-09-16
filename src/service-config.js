// Per-person foreground-minute budgets; never derived from wallet balance.
export const SERVICE_CONFIG={
  "foodShare": 0.01,
  "simpleShare": 0.003,
  "generousShare": 0.007,
  "bounds": {
    "village": [
      0.5,
      12
    ],
    "industrial": [
      2,
      48
    ],
    "modern": [
      4,
      192
    ],
    "nether": [
      8,
      768
    ],
    "end": [
      16,
      3072
    ]
  },
  "happinessCap": 0.25,
  "mealRest": 12
};
