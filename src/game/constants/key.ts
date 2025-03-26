const atlas = {
  player: 'player',
} as const;

const image = {
  spaceman: 'spaceman',
  tuxemon: 'tuxemon',
  logo: 'logo',
  coin: 'coin',
  bird: 'bird',
  coinIcon: 'coinIcon',
  office: 'office',
  room_builder_office: 'room_builder_office',
  mail: 'mail',
  idle: 'idle',
  work: 'work',
  report: 'report',
  hiring: "hiring",
} as const;

const scene = {
  boot: 'boot',
  main: 'main',
  menu: 'menu',
} as const;

const tilemap = {
  tuxemon: 'tuxemon',
  office: 'office',
  room_builder_office: 'room_builder_office',
} as const;

export const key = {
  atlas,
  image,
  scene,
  tilemap,
} as const;
