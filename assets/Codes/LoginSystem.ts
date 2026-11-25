import { _decorator, Component } from "cc";

const { ccclass } = _decorator;

export enum LoginStep {
  USERNAME = "username",
  BIRTHDAY = "birthday",
  PASSWORD = "password",
  DONE = "done",
}

export interface LoginCallbacks {
  onPrompt: (text: string, color?: string) => void;
  onError: (text: string) => void;
  onSuccess: (username: string, birthday: string) => void;
  onCancel?: () => void;
}

@ccclass("LoginSystem")
export class LoginSystem extends Component {
  private currentStep: LoginStep = LoginStep.USERNAME;
  private username: string = "";
  private birthday: string = "";
  private password: string = "YKW2024";

  private callbacks: LoginCallbacks = null!;

  init(callbacks: LoginCallbacks) {
    this.callbacks = callbacks;
    this.currentStep = LoginStep.USERNAME;
    this.username = "";
    this.birthday = "";
    this.showWelcomeScreen();
  }

  private showWelcomeScreen() {
    this.callbacks.onPrompt("正在启动YKW内部调查系统...");
    this.callbacks.onPrompt("");
    this.callbacks.onPrompt(
      "请输入<color=#CE831E>角色昵称</color>进行身份验证:",
    );
    this.callbacks.onPrompt(
      "提示：登录过程中可输入 <color=#CE831E>help</color> 查看指令，输入 <color=#CE831E>exit</color> 退出登录。",
      "#AAAAAA",
    );
  }

  processInput(input: string): boolean {
    const rawInput = input.trim();
    const cmd = rawInput.toLowerCase();

    if (cmd === "help") {
      this.showLoginHelp();
      return true;
    }

    if (cmd === "exit" || cmd === "cancel" || cmd === "quit") {
      this.cancelLogin();
      return true;
    }

    if (cmd === "restart" || cmd === "reset") {
      this.restartLogin();
      return true;
    }

    if (cmd === "back") {
      this.goBackStep();
      return true;
    }

    switch (this.currentStep) {
      case LoginStep.USERNAME:
        return this.handleUsername(input);
      case LoginStep.BIRTHDAY:
        return this.handleBirthday(rawInput);
      case LoginStep.PASSWORD:
        return this.handlePassword(rawInput);
      default:
        return false;
    }
  }

  private showLoginHelp() {
    this.callbacks.onPrompt("登录阶段可用指令:", "#00FF00");
    this.callbacks.onPrompt(
      "  <color=#CE831E>help</color>     - 显示登录帮助",
    );
    this.callbacks.onPrompt(
      "  <color=#CE831E>password</color> - 在密码阶段显示临时密码",
    );
    this.callbacks.onPrompt(
      "  <color=#CE831E>back</color>     - 返回上一步",
    );
    this.callbacks.onPrompt(
      "  <color=#CE831E>restart</color>  - 重新开始登录",
    );
    this.callbacks.onPrompt(
      "  <color=#CE831E>exit</color>     - 退出登录，返回初始终端",
    );
  }

  private cancelLogin() {
    this.currentStep = LoginStep.USERNAME;
    this.username = "";
    this.birthday = "";
    this.callbacks.onPrompt("已退出登录流程。", "#AAAAAA");
    this.callbacks.onCancel?.();
  }

  private restartLogin() {
    this.currentStep = LoginStep.USERNAME;
    this.username = "";
    this.birthday = "";
    this.callbacks.onPrompt("已重新开始登录。", "#AAAAAA");
    this.callbacks.onPrompt(
      "请输入<color=#CE831E>角色昵称</color>进行身份验证:",
    );
  }

  private goBackStep() {
    if (this.currentStep === LoginStep.PASSWORD) {
      this.currentStep = LoginStep.BIRTHDAY;
      this.birthday = "";
      this.callbacks.onPrompt(
        "已返回生日输入步骤。请输入角色生日 (格式: MM-DD，如 12-25):",
        "#AAAAAA",
      );
      return;
    }

    if (this.currentStep === LoginStep.BIRTHDAY) {
      this.currentStep = LoginStep.USERNAME;
      this.username = "";
      this.callbacks.onPrompt("已返回用户名输入步骤。请输入用户名:", "#AAAAAA");
      return;
    }

    this.callbacks.onPrompt(
      "当前已经是登录第一步。如需退出，请输入 <color=#CE831E>exit</color>。",
      "#AAAAAA",
    );
  }

  private handleUsername(input: string): boolean {
    const trimmed = input.trim();

    if (trimmed === "") {
      this.callbacks.onError("用户名不能为空");
      return false;
    }

    if (trimmed.length > 20) {
      this.callbacks.onError("用户名不能超过20个字符");
      return false;
    }

    if (trimmed.length < 2) {
      this.callbacks.onError("用户名至少需要2个字符");
      return false;
    }

    const validPattern = /^[a-zA-Z0-9\u4e00-\u9fa5_]+$/;
    if (!validPattern.test(trimmed)) {
      this.callbacks.onError("用户名只能包含中文、英文、数字和下划线");
      return false;
    }

    if (input !== trimmed || input.includes(" ")) {
      this.callbacks.onError("用户名不能包含空格");
      return false;
    }

    const forbiddenCommands = [
      "help",
      "thing",
      "word",
      "bag",
      "sos",
      "exit",
      "cancel",
      "quit",
      "save",
      "load",
      "status",
      "login",
      "password",
      "test",
      "answer",
      "submit",
      "restart",
      "reset",
      "back",
      "yes",
      "no",
      "all",
      "alex",
      "ben",
      "cathy",
      "diana",
      "elsa",
    ];

    if (forbiddenCommands.includes(trimmed.toLowerCase())) {
      this.callbacks.onError("用户名不能使用系统命令或人物名作为名称");
      return false;
    }

    this.username = trimmed;
    this.callbacks.onPrompt(`欢迎，${this.username}。`);
    this.callbacks.onPrompt("");
    this.callbacks.onPrompt(
      "请输入<color=#CE831E>角色生日</color> (可虚构，格式: MM-DD，如 12-25):",
    );

    this.currentStep = LoginStep.BIRTHDAY;
    return true;
  }

  private handleBirthday(input: string): boolean {
    const birthdayRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

    if (!birthdayRegex.test(input)) {
      this.callbacks.onError(
        "格式错误！请输入 MM-DD 格式，例如 05-20。输入 back 返回上一步，输入 exit 退出登录。",
      );
      return false;
    }

    this.birthday = input;
    this.callbacks.onPrompt(`生日已记录: ${this.birthday}`);
    this.callbacks.onPrompt("Password?");
    this.callbacks.onPrompt(
      "提示：输入 <color=#CE831E>password</color> 可查看临时密码；输入 <color=#CE831E>back</color> 返回生日；输入 <color=#CE831E>exit</color> 退出登录。",
      "#AAAAAA",
    );

    this.currentStep = LoginStep.PASSWORD;
    return true;
  }

  private handlePassword(input: string): boolean {
    const cmd = input.toLowerCase();

    if (cmd === "password") {
      this.callbacks.onPrompt(`<color=#CE831E>${this.password}</color>`);
      this.callbacks.onPrompt("请继续输入密码，或输入 exit 退出登录。", "#AAAAAA");
      return false;
    }

    if (input !== this.password) {
      this.callbacks.onError(
        "密码错误。请重新输入；输入 password 查看临时密码；输入 back 返回上一步；输入 exit 退出登录。",
      );
      return false;
    }

    this.callbacks.onPrompt("登录成功！正在启动YKW调查终端...");
    this.callbacks.onPrompt("");

    this.currentStep = LoginStep.DONE;

    this.callbacks.onSuccess(this.username, this.birthday);
    return true;
  }

  isLoggedIn(): boolean {
    return this.currentStep === LoginStep.DONE;
  }

  getUsername(): string {
    return this.username;
  }
}
