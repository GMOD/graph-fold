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
]
