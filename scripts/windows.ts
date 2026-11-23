export const walkFile =
  'https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38-f8.GRCh38.walks.gz'

export const windows = [
  {
    id: 'chr15-alleles',
    title: 'chr15:92,768,150-92,768,700, six alleles of 50 to 156 bp',
    refName: 'chr15',
    start: 92_768_150,
    end: 92_768_700,
    file: 'test/fixtures/chr15-92768150-92768700.json',
  },
  {
    id: 'chr1-deletion',
    title: 'chr1:72,298,000-72,349,000, a 46 kb deletion and a 9 kb insertion',
    refName: 'chr1',
    start: 72_298_000,
    end: 72_349_000,
    file: 'data/chr1-72298000-72349000.json',
  },
  {
    id: 'chr16-inversion',
    title: 'chr16:75,204,000-75,225,000, a 16.5 kb inversion',
    refName: 'chr16',
    start: 75_204_000,
    end: 75_225_000,
    file: 'data/chr16-75204000-75225000.json',
  },
  {
    id: 'chr14-inversion',
    title:
      'chr14:34,543,000-34,562,000, a 7.4 kb inversion with deletions inside and beside it',
    refName: 'chr14',
    start: 34_543_000,
    end: 34_562_000,
    file: 'data/chr14-34543000-34562000.json',
    drawnAt: 1000,
  },
  {
    id: 'chr6-c4',
    title:
      'chr6:31,970,000-32,050,000, C4A and C4B: copies as insertions, a deletion inside a deletion',
    refName: 'chr6',
    start: 31_970_000,
    end: 32_050_000,
    file: 'data/chr6-31970000-32050000.json',
    drawnAt: 1000,
  },
  {
    id: 'chr1-amy1',
    title:
      'chr1:103,550,000-103,800,000, AMY1: reference walked up to eight times, forward and reversed',
    refName: 'chr1',
    start: 103_550_000,
    end: 103_800_000,
    file: 'data/chr1-103550000-103800000.json',
    drawnAt: 5000,
  },
]

export const expectedBranches = [
  ['chr14-inversion', 1000, 'inversion', 34_547_851, 34_555_251, 196],
  ['chr14-inversion', 1000, 'inversion', 34_550_217, 34_555_251, 3],
  ['chr14-inversion', 1000, 'deletion', 34_547_851, 34_550_217, 3],
  ['chr14-inversion', 1000, 'deletion', 34_550_650, 34_553_366, 3],
  ['chr14-inversion', 1000, 'deletion', 34_555_251, 34_557_775, 3],
  ['chr6-c4', 1000, 'deletion', 31_984_685, 31_991_052, 17],
  ['chr6-c4', 1000, 'deletion', 31_996_629, 32_029_366, 155],
  ['chr6-c4', 1000, 'deletion', 32_017_423, 32_023_790, 225],
  ['chr1-amy1', 5000, 'deletion', 103_620_893, 103_715_097, 378],
] as const
