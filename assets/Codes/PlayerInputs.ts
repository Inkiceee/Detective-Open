import { _decorator, Component, input, Input, EventKeyboard, KeyCode } from 'cc';
import { MapManager } from './MapManager';
const { ccclass, property } = _decorator;

@ccclass('PlayerInput')
export class PlayerInput extends Component {

    @property(MapManager)
    map: MapManager = null!;

    start() {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    onKeyDown(e: EventKeyboard) {
        switch (e.keyCode) {
            // WASD
            case KeyCode.KEY_W: this.map.move(0, 1); break;
            case KeyCode.KEY_S: this.map.move(0, -1); break;
            case KeyCode.KEY_A: this.map.move(-1, 0); break;
            case KeyCode.KEY_D: this.map.move(1, 0); break;
            // 方向键
            case KeyCode.ARROW_UP:    this.map.move(0, 1); break;
            case KeyCode.ARROW_DOWN:  this.map.move(0, -1); break;
            case KeyCode.ARROW_LEFT:  this.map.move(-1, 0); break;
            case KeyCode.ARROW_RIGHT: this.map.move(1, 0); break;
            default: break;
        }
    }
}