import { _decorator, Component, Prefab, instantiate, Node, Vec3 } from "cc";
const { ccclass, property } = _decorator;

@ccclass("MapManager")
export class MapManager extends Component {
  @property(Prefab)
  floorPrefab: Prefab = null!;

  @property(Prefab)
  wallPrefab: Prefab = null!;

  @property(Prefab)
  playerPrefab: Prefab = null!;

  @property(Prefab)
  boxPrefab: Prefab = null!;

  @property(Prefab)
  goalPrefab: Prefab = null!;

  tileSize = 50;
  mapSize = 15; // 默认大小，会在加载关卡时自动更新

  // grid 只存储：0=空地，1=墙，2=玩家，3=箱子
  grid: number[][] = [];

  // 单独记录目标点位置
  goals: boolean[][] = [];
  playerPos = { x: 0, y: 0 };

  private dynamicNodes: (Node | null)[][] = [];
  private goalNodes: (Node | null)[][] = [];
  private onVictoryCallback: (() => void) | null = null;
  private hasWon = false;

  /**
   * 加载关卡数据（外部调用）
   * 关卡数值：0=空地，1=墙，2=玩家，3=箱子，4=目标点，5=玩家在目标点，6=箱子在目标点
   */
  loadLevel(levelData: number[][]) {
    if (!levelData || levelData.length === 0) {
      console.error("[MapManager] levelData 为空，无法加载关卡。");
      return;
    }

    this.mapSize = levelData.length; // 当前项目使用 15x15 正方形地图
    this.hasWon = false;

    this.parseLevelData(levelData);
    this.clearMap();
    this.buildStaticLayer();
    this.buildGoalLayer();
    this.renderDynamicLayer();
  }

  private parseLevelData(data: number[][]) {
    this.grid = [];
    this.goals = [];
    this.playerPos = { x: 0, y: 0 };

    let foundPlayer = false;

    for (let y = 0; y < this.mapSize; y++) {
      this.grid[y] = [];
      this.goals[y] = [];

      for (let x = 0; x < this.mapSize; x++) {
        const val = data[y] && data[y][x] !== undefined ? data[y][x] : 0;
        this.goals[y][x] = false;

        // 根据数值转换到 grid 和 goals
        switch (val) {
          case 0: // 空地
            this.grid[y][x] = 0;
            break;
          case 1: // 墙
            this.grid[y][x] = 1;
            break;
          case 2: // 玩家
            this.grid[y][x] = 0;
            this.playerPos = { x, y };
            foundPlayer = true;
            break;
          case 3: // 箱子
            this.grid[y][x] = 3;
            break;
          case 4: // 目标点
            this.grid[y][x] = 0;
            this.goals[y][x] = true;
            break;
          case 5: // 玩家站在目标点上
            this.grid[y][x] = 0;
            this.goals[y][x] = true;
            this.playerPos = { x, y };
            foundPlayer = true;
            break;
          case 6: // 箱子在目标点上
            this.grid[y][x] = 3;
            this.goals[y][x] = true;
            break;
          default:
            this.grid[y][x] = 0;
            break;
        }
      }
    }

    if (!foundPlayer) {
      console.warn("[MapManager] 当前关卡没有玩家出生点 2 或 5，默认放在 (0, 0)。");
    }

    // 将玩家位置填入 grid（必须在循环外，因为可能被后面的格子覆盖）
    this.grid[this.playerPos.y][this.playerPos.x] = 2;
  }

  private clearMap() {
    this.node.removeAllChildren();
    this.dynamicNodes = [];
    this.goalNodes = [];
  }

  private getTilePosition(x: number, y: number): Vec3 {
    const startX = -(this.mapSize * this.tileSize) / 2 + this.tileSize / 2;
    const startY = -(this.mapSize * this.tileSize) / 2 + this.tileSize / 2;
    return new Vec3(startX + x * this.tileSize, startY + y * this.tileSize, 0);
  }

  private buildStaticLayer() {
    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const pos = this.getTilePosition(x, y);

        const floor = instantiate(this.floorPrefab);
        floor.setParent(this.node);
        floor.setPosition(pos);

        if (this.grid[y][x] === 1) {
          const wall = instantiate(this.wallPrefab);
          wall.setParent(this.node);
          wall.setPosition(pos);
        }
      }
    }
  }

  private buildGoalLayer() {
    for (let y = 0; y < this.mapSize; y++) {
      this.goalNodes[y] = new Array(this.mapSize).fill(null);

      for (let x = 0; x < this.mapSize; x++) {
        if (this.goals[y][x]) {
          const goal = instantiate(this.goalPrefab);
          goal.setParent(this.node);
          goal.setPosition(this.getTilePosition(x, y));
          this.goalNodes[y][x] = goal;
        }
      }
    }
  }

  private renderDynamicLayer() {
    if (this.dynamicNodes.length === 0) {
      for (let y = 0; y < this.mapSize; y++) {
        this.dynamicNodes[y] = new Array(this.mapSize).fill(null);
      }
    }

    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const val = this.grid[y][x];
        const pos = this.getTilePosition(x, y);

        if (val === 2 || val === 3) {
          let node = this.dynamicNodes[y][x];
          const expectedType = val;

          if (node) {
            const currentType = (node as any).tileType;
            if (currentType !== expectedType) {
              node.removeFromParent();
              node = this.createDynamicNode(expectedType, pos);
              this.dynamicNodes[y][x] = node;
            } else {
              node.setPosition(pos);
            }
          } else {
            node = this.createDynamicNode(expectedType, pos);
            this.dynamicNodes[y][x] = node;
          }
        } else {
          const node = this.dynamicNodes[y][x];
          if (node) {
            node.removeFromParent();
            this.dynamicNodes[y][x] = null;
          }
        }
      }
    }
  }

  private createDynamicNode(type: number, pos: Vec3): Node {
    let node: Node;

    switch (type) {
      case 2:
        node = instantiate(this.playerPrefab);
        break;
      case 3:
        node = instantiate(this.boxPrefab);
        break;
      default:
        throw new Error(`Unknown dynamic type: ${type}`);
    }

    node.setParent(this.node);
    node.setPosition(pos);
    (node as any).tileType = type;
    return node;
  }

  private isInside(x: number, y: number): boolean {
    return x >= 0 && x < this.mapSize && y >= 0 && y < this.mapSize;
  }

  move(dx: number, dy: number) {
    if (this.hasWon) return;

    const x = this.playerPos.x;
    const y = this.playerPos.y;
    const nx = x + dx;
    const ny = y + dy;

    if (!this.isInside(nx, ny)) return;
    if (this.grid[ny][nx] === 1) return;

    if (this.grid[ny][nx] === 3) {
      const bx = nx + dx;
      const by = ny + dy;

      if (!this.isInside(bx, by)) return;
      if (this.grid[by][bx] === 1 || this.grid[by][bx] === 3) return;

      this.grid[by][bx] = 3;
      this.grid[ny][nx] = 0;
    }

    this.grid[y][x] = 0;
    this.grid[ny][nx] = 2;
    this.playerPos = { x: nx, y: ny };

    this.renderDynamicLayer();

    if (this.checkVictory()) {
      this.hasWon = true;
      if (this.onVictoryCallback) {
        this.onVictoryCallback();
      }
    }
  }

  // 注册胜利回调
  public setOnVictoryCallback(callback: () => void) {
    this.onVictoryCallback = callback;
  }

  // 检查是否胜利
  private checkVictory(): boolean {
    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        // 如果是目标点，但该位置没有箱子
        if (this.goals[y][x] && this.grid[y][x] !== 3) {
          return false;
        }
      }
    }
    return true;
  }
}
