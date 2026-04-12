export type WilayaCommuneEntry = {
  code: string
  wilaya: string
  communes: number[]
}

const WILAYAS_COMMUNES: WilayaCommuneEntry[] = [
  {
    "code": "01A",
    "wilaya": "ADRAR",
    "communes": [
      101,
      104,
      109
    ]
  },
  {
    "code": "02A",
    "wilaya": "CHLEF",
    "communes": [
      201,
      229,
      202,
      224,
      212
    ]
  },
  {
    "code": "04A",
    "wilaya": "Oum El Bouaghi",
    "communes": [
      425,
      403,
      402,
      401
    ]
  },
  {
    "code": "05A",
    "wilaya": "Batna",
    "communes": [
      545,
      501
    ]
  },
  {
    "code": "06A",
    "wilaya": "BEJAIA",
    "communes": [
      601,
      644,
      625,
      602
    ]
  },
  {
    "code": "07A",
    "wilaya": "BISKRA",
    "communes": [
      701,
      721
    ]
  },
  {
    "code": "08A",
    "wilaya": "BECHAR",
    "communes": [
      817,
      801
    ]
  },
  {
    "code": "09A",
    "wilaya": "BOUINANE",
    "communes": [
      904,
      901,
      907,
      920
    ]
  },
  {
    "code": "10A",
    "wilaya": "BOUIRA",
    "communes": [
      1001
    ]
  },
  {
    "code": "11A",
    "wilaya": "TAM",
    "communes": [
      1101,
      1108
    ]
  },
  {
    "code": "12A",
    "wilaya": "TEBESSA",
    "communes": [
      1202,
      1201,
      1209,
      1219
    ]
  },
  {
    "code": "13A",
    "wilaya": "Tlemcen",
    "communes": [
      1304,
      1301,
      1327
    ]
  },
  {
    "code": "14A",
    "wilaya": "FRENDA",
    "communes": [
      1427,
      1401,
      1429
    ]
  },
  {
    "code": "15A",
    "wilaya": "TIZI OUZOU",
    "communes": [
      1501,
      1518
    ]
  },
  {
    "code": "16A",
    "wilaya": "ALGER A",
    "communes": [
      1605,
      1607
    ]
  },
  {
    "code": "16B",
    "wilaya": "ALGER",
    "communes": [
      1617,
      1618,
      1620,
      1621,
      1642,
      1613
    ]
  },
  {
    "code": "16C",
    "wilaya": "ALGER",
    "communes": [
      1628,
      1653,
      1623,
      1646,
      1644,
      1610
    ]
  },
  {
    "code": "17A",
    "wilaya": "AIN OUSSERA",
    "communes": [
      1731,
      1717,
      1701
    ]
  },
  {
    "code": "18A",
    "wilaya": "JIJEL",
    "communes": [
      1809,
      1801,
      1805
    ]
  },
  {
    "code": "19A",
    "wilaya": "SETIF",
    "communes": [
      1943,
      1920,
      1928,
      1901
    ]
  },
  {
    "code": "20A",
    "wilaya": "Saïda",
    "communes": [
      2001
    ]
  },
  {
    "code": "21A",
    "wilaya": "SKIKDA",
    "communes": [
      2101,
      2104,
      2110,
      2116
    ]
  },
  {
    "code": "22A",
    "wilaya": "Sidi Bel Abbès",
    "communes": [
      2245,
      2201,
      2227
    ]
  },
  {
    "code": "23A",
    "wilaya": "ANNABA",
    "communes": [
      2305,
      2303,
      2301
    ]
  },
  {
    "code": "24A",
    "wilaya": "GUELMA",
    "communes": [
      2425,
      2401,
      2404
    ]
  },
  {
    "code": "25A",
    "wilaya": "Constantine",
    "communes": [
      2504,
      2501,
      2506,
      2502
    ]
  },
  {
    "code": "26A",
    "wilaya": "KASR EL BOUKHARI",
    "communes": [
      2635,
      2646,
      2601
    ]
  },
  {
    "code": "27A",
    "wilaya": "Mostaganem",
    "communes": [
      2701
    ]
  },
  {
    "code": "28A",
    "wilaya": "M'SILA",
    "communes": [
      2816,
      2820,
      2801
    ]
  },
  {
    "code": "29A",
    "wilaya": "Mascara",
    "communes": [
      2906,
      2901
    ]
  },
  {
    "code": "301A",
    "wilaya": "LAGHOUAT",
    "communes": [
      301
    ]
  },
  {
    "code": "30A",
    "wilaya": "OUARGLA",
    "communes": [
      3001,
      3013,
      3004
    ]
  },
  {
    "code": "319A",
    "wilaya": "AFLOU",
    "communes": [
      319
    ]
  },
  {
    "code": "31B",
    "wilaya": "Oran ouest",
    "communes": [
      3109,
      3105,
      3101
    ]
  },
  {
    "code": "31C",
    "wilaya": "Oran est",
    "communes": [
      3106
    ]
  },
  {
    "code": "32A",
    "wilaya": "EL BAYADH",
    "communes": [
      3207,
      3201
    ]
  },
  {
    "code": "33A",
    "wilaya": "ILLZI",
    "communes": [
      3301,
      3302,
      3306
    ]
  },
  {
    "code": "34A",
    "wilaya": "BBA",
    "communes": [
      3402,
      3401
    ]
  },
  {
    "code": "35A",
    "wilaya": "BOUMERDES",
    "communes": [
      3501,
      3505
    ]
  },
  {
    "code": "36A",
    "wilaya": "ELTARF",
    "communes": [
      3605,
      3601
    ]
  },
  {
    "code": "37A",
    "wilaya": "TINDOUF",
    "communes": [
      3701
    ]
  },
  {
    "code": "38A",
    "wilaya": "BORDJ BOUNAAMA",
    "communes": [
      3802,
      3801,
      3808
    ]
  },
  {
    "code": "39A",
    "wilaya": "EL-OUED",
    "communes": [
      3901,
      3906,
      3902,
      3927
    ]
  },
  {
    "code": "40A",
    "wilaya": "Khenchela",
    "communes": [
      4003,
      4001
    ]
  },
  {
    "code": "41A",
    "wilaya": "SOUK AHRAS",
    "communes": [
      4101,
      4102
    ]
  },
  {
    "code": "42A",
    "wilaya": "TIPAZA",
    "communes": [
      4212,
      4222,
      4201,
      4235
    ]
  },
  {
    "code": "43A",
    "wilaya": "Mila",
    "communes": [
      4308,
      4302,
      4301,
      4303
    ]
  },
  {
    "code": "44A",
    "wilaya": "AIN DEFLA",
    "communes": [
      4401,
      4404
    ]
  },
  {
    "code": "45A",
    "wilaya": "NAAMA",
    "communes": [
      4501,
      4503,
      4502
    ]
  },
  {
    "code": "46A",
    "wilaya": "Ain Témouchent",
    "communes": [
      4604,
      4623,
      4601
    ]
  },
  {
    "code": "47A",
    "wilaya": "GHARDAIA",
    "communes": [
      4701,
      4702,
      4705,
      4706
    ]
  },
  {
    "code": "48A",
    "wilaya": "MAZOUNA",
    "communes": [
      4822,
      4801,
      4802,
      4811
    ]
  },
  {
    "code": "52A",
    "wilaya": "BENI ABBES",
    "communes": [
      807
    ]
  }
]

export default WILAYAS_COMMUNES
