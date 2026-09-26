/** Battle stage definition (filled in by the stage catalogue). */
export interface ArenaDef {
  id: string;
  name: string;
  spawns?: [number, number][];
  extraHard?: [number, number][];
  removeHard?: [number, number][];
  noSoft?: [number, number][];
}
