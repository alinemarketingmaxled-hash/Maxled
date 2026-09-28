/** Hand-made side-view pose illustrations (start / end position) for the
 * exercises Free Exercise DB has no photos for. Coordinates live in a
 * 200×130 box with the floor at y=118; each limb is two segments. */
type Pt = [number, number];

export type Pose = {
  head: Pt;
  neck: Pt;
  hip: Pt;
  elbowL: Pt;
  handL: Pt;
  elbowR: Pt;
  handR: Pt;
  kneeL: Pt;
  footL: Pt;
  kneeR: Pt;
  footR: Pt;
  /** Equipment / environment: lines (towel, wall) and dots (stick end). */
  props?: ({ line: [Pt, Pt]; wall?: boolean } | { dot: Pt })[];
};

const standing = (over: Partial<Pose> = {}): Pose => ({
  head: [100, 26],
  neck: [100, 40],
  hip: [100, 74],
  elbowL: [101, 57],
  handL: [103, 74],
  elbowR: [99, 57],
  handR: [101, 74],
  kneeL: [101, 96],
  footL: [103, 118],
  kneeR: [98, 96],
  footR: [97, 118],
  ...over,
});

const quadruped = (over: Partial<Pose> = {}): Pose => ({
  head: [58, 70],
  neck: [70, 78],
  hip: [120, 80],
  elbowL: [70, 97],
  handL: [70, 116],
  elbowR: [72, 97],
  handR: [72, 116],
  kneeL: [120, 112],
  footL: [146, 116],
  kneeR: [122, 112],
  footR: [148, 116],
  ...over,
});

const DOOR = { line: [[184, 8], [184, 118]] as [Pt, Pt], wall: true };
const WALL = { line: [[62, 8], [62, 118]] as [Pt, Pt], wall: true };

export const POSES: Record<string, [Pose, Pose]> = {
  remada_toalha: [
    {
      head: [82, 30], neck: [88, 42], hip: [108, 76],
      elbowL: [110, 50], handL: [132, 58], elbowR: [112, 52], handR: [134, 60],
      kneeL: [122, 96], footL: [128, 118], kneeR: [126, 96], footR: [134, 118],
      props: [DOOR, { line: [[133, 59], [184, 62]] }],
    },
    {
      head: [96, 28], neck: [100, 40], hip: [112, 76],
      elbowL: [86, 58], handL: [116, 56], elbowR: [88, 60], handR: [118, 58],
      kneeL: [122, 96], footL: [128, 118], kneeR: [126, 96], footR: [134, 118],
      props: [DOOR, { line: [[117, 57], [184, 62]] }],
    },
  ],
  pike_pushup: [
    {
      head: [74, 97], neck: [72, 84], hip: [110, 48],
      elbowL: [67, 101], handL: [62, 118], elbowR: [69, 101], handR: [66, 118],
      kneeL: [128, 82], footL: [146, 118], kneeR: [131, 82], footR: [150, 118],
    },
    {
      head: [74, 109], neck: [80, 97], hip: [112, 54],
      elbowL: [90, 106], handL: [64, 118], elbowR: [92, 107], handR: [67, 118],
      kneeL: [130, 85], footL: [146, 118], kneeR: [133, 85], footR: [150, 118],
    },
  ],
  y_raise: [
    {
      head: [48, 104], neck: [58, 108], hip: [110, 110],
      elbowL: [40, 114], handL: [22, 116], elbowR: [41, 113], handR: [23, 115],
      kneeL: [135, 112], footL: [160, 114], kneeR: [135, 113], footR: [160, 115],
    },
    {
      head: [47, 100], neck: [58, 106], hip: [110, 110],
      elbowL: [40, 98], handL: [24, 90], elbowR: [41, 97], handR: [25, 89],
      kneeL: [135, 112], footL: [160, 114], kneeR: [135, 113], footR: [160, 115],
    },
  ],
  rosca_toalha: [
    standing({ elbowL: [102, 58], handL: [104, 76], elbowR: [100, 58], handR: [102, 76], props: [{ line: [[103, 76], [104, 118]] }] }),
    standing({ elbowL: [102, 58], handL: [118, 50], elbowR: [100, 58], handR: [116, 50], props: [{ line: [[117, 50], [104, 118]] }] }),
  ],
  agachamento_isometrico: [
    standing({ head: [74, 26], neck: [74, 40], hip: [74, 74], elbowL: [76, 58], handL: [78, 74], elbowR: [75, 58], handR: [77, 74], kneeL: [76, 96], footL: [78, 118], kneeR: [75, 96], footR: [76, 118], props: [WALL] }),
    {
      head: [72, 47], neck: [72, 60], hip: [72, 94],
      elbowL: [84, 72], handL: [94, 74], elbowR: [83, 73], handR: [93, 75],
      kneeL: [98, 94], footL: [98, 118], kneeR: [97, 95], footR: [96, 118],
      props: [WALL],
    },
  ],
  bird_dog: [quadruped(), quadruped({ elbowR: [48, 76], handR: [28, 74], kneeL: [145, 80], footL: [170, 80] })],
  hollow_hold: [
    {
      head: [40, 108], neck: [50, 110], hip: [105, 112],
      elbowL: [30, 112], handL: [14, 112], elbowR: [31, 111], handR: [15, 111],
      kneeL: [130, 112], footL: [155, 113], kneeR: [130, 111], footR: [155, 112],
    },
    {
      head: [44, 94], neck: [54, 100], hip: [105, 112],
      elbowL: [36, 90], handL: [20, 82], elbowR: [37, 89], handR: [21, 81],
      kneeL: [130, 102], footL: [156, 92], kneeR: [130, 101], footR: [156, 91],
    },
  ],
  burpee: [
    standing({ elbowL: [106, 26], handL: [108, 10], elbowR: [104, 26], handR: [106, 10] }),
    {
      head: [50, 78], neck: [62, 82], hip: [110, 92],
      elbowL: [61, 100], handL: [60, 118], elbowR: [63, 100], handR: [62, 118],
      kneeL: [135, 104], footL: [160, 116], kneeR: [136, 105], footR: [162, 117],
    },
  ],
  shadow_boxing: [
    standing({ neck: [98, 40], hip: [96, 74], elbowL: [108, 56], handL: [110, 36], elbowR: [100, 58], handR: [106, 38], kneeL: [108, 96], footL: [116, 118], kneeR: [86, 96], footR: [80, 118] }),
    standing({ head: [103, 27], neck: [100, 40], hip: [96, 74], elbowL: [122, 42], handL: [144, 40], elbowR: [100, 58], handR: [106, 38], kneeL: [108, 96], footL: [116, 118], kneeR: [86, 96], footR: [80, 118] }),
  ],
  mob_quadril: [
    {
      head: [100, 60], neck: [100, 72], hip: [100, 112],
      elbowL: [88, 94], handL: [82, 114], elbowR: [90, 95], handR: [84, 115],
      kneeL: [126, 108], footL: [112, 117], kneeR: [78, 112], footR: [68, 100],
    },
    {
      head: [126, 66], neck: [116, 76], hip: [100, 112],
      elbowL: [120, 94], handL: [126, 106], elbowR: [118, 95], handR: [124, 107],
      kneeL: [126, 108], footL: [112, 117], kneeR: [78, 112], footR: [68, 100],
    },
  ],
  mob_toracica: [
    quadruped({ elbowR: [74, 102], handR: [60, 76] }),
    quadruped({ head: [60, 66], elbowR: [82, 50], handR: [62, 72] }),
  ],
  deslocamento_ombro: [
    standing({ elbowL: [106, 58], handL: [112, 76], elbowR: [104, 58], handR: [110, 76], props: [{ dot: [111, 76] }] }),
    standing({ elbowL: [96, 22], handL: [84, 8], elbowR: [95, 23], handR: [83, 9], props: [{ dot: [84, 8] }] }),
  ],
  agachamento_profundo: [
    standing({ elbowL: [108, 52], handL: [118, 60], elbowR: [106, 52], handR: [116, 60] }),
    {
      head: [112, 56], neck: [104, 67], hip: [90, 104],
      elbowL: [116, 86], handL: [110, 98], elbowR: [114, 87], handR: [108, 99],
      kneeL: [114, 92], footL: [104, 118], kneeR: [112, 94], footR: [100, 118],
    },
  ],
};
