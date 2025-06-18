const atlas = {
  player: 'player',
  bias: 'biasAtlas',
  workPlayer: 'workPlayer',
  workBias: 'workBias',
} as const;

const image = {
  spaceman: 'spaceman',
  tuxemon: 'tuxemon',
  logo: 'logo',
  coin: 'coin',
  bird: 'bird',
  coinIcon: 'coinIcon',
  baseball: 'baseball',
  kidney: 'kidney',
  restart: 'restart',
  office: 'office',
  room_builder_office: 'room_builder_office',
  interior: 'interior',
  exterior: 'exterior',
  mail: 'mail',
  idle: 'idle',
  work: 'work',
  report: 'report',
  hiring: "hiring",
  start: "start",
  sequential: "sequential",
  voting: "voting",
  single_agent: "single_agent",
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
  interior: 'interior',
  exterior: 'exterior',
} as const;

export const key = {
  atlas,
  image,
  scene,
  tilemap,
} as const;
