import {Label} from "@akashic-extension/akashic-label";


function main(param: g.GameMainParameterObject): void {
    // 一番最初にJoinした人を覚える変数
    let gameMasterId: string | null = null;

    // 誰かがJoinして来たときの処理。ニコ生においては生主が一人だけJoinしてくる想定なので、その人のIDをゲームマスターとする
    // addOnceしてるのでこの処理は一回しか呼ばれない（仮に誰かもう一人joinしてきても何も起きない）
    g.game.join.addOnce((e) => {
        gameMasterId = e.player.id;
    });

    // ゲームに参加した人を管理するための配列。AkashicのJoin/Leaveとは関係ないこのゲームとしての仕組み
    let players: string[] = [];

    // ゲームの状態を管理するための変数。シーン遷移ではなくシーン内の状態遷移によってゲームの進行を管理する
    //  gameMasterWaiting, initializing, waiting, playStarting, playing
    let gameStatus = "gameMasterWaiting";

    let timer = 0;

    const scene = new g.Scene({
        game: g.game
    });

    scene.loaded.add(() => {
        const background = new g.FilledRect({
            scene: scene,
            cssColor: "rgba(0,0,0,0.2)",
            height: g.game.height,
            width: g.game.width
        });
        scene.append(background);
    });
    g.game.pushScene(scene);

    // パーツ類の定義 ---------------------------------------------------------------------
    const font = new g.DynamicFont({game: g.game, fontFamily: g.FontFamily.SansSerif, size: 20});

    // ゲームの情報を表示するためのラベル
    // 人によって内容が違うのでローカルにしとく
    const infoLabel = new Label({
        scene: scene,
        font: font,
        fontSize: 30,
        text: "放送者のjoinを待っています",
        width: g.game.width
    });
    scene.append(infoLabel);

    // 放送者のためのボタン（参加締め切りボタン）
    // 放送者しか押さないのでローカルにしておく必要あり
    const closeButton = new g.FilledRect({
        scene: scene,
        cssColor: "red",
        height: 22,
        width: 120,
        local: true,
        touchable: true
    });
    closeButton.append(new g.Label({
        scene: scene,
        font: font,
        fontSize: 20,
        text: "参加締め切り",
        textColor: "black",
        local: true,
    }));
    closeButton.x = (g.game.width / 2) - (closeButton.width / 2);
    closeButton.y = g.game.height - (closeButton.height * 2);
    closeButton.modified();

    closeButton.pointDown.add(() => {
        scene.remove(closeButton);

        // このボタンの処理は放送者でしか発生しないので、ゲーム全体の進行のため全体に通知する
        g.game.raiseEvent(new g.MessageEvent({message: "EntryClosed"}));
    });

    // 放送者以外の人のためのボタン（参加ボタン）
    // 放送者以外の人しか押せないためローカルにしておく必要あり
    const entryButton = new g.FilledRect({
        scene: scene,
        cssColor: "pink",
        height: 22,
        width: 100,
        local: true,
        touchable: true
    });
    entryButton.append(new g.Label({
        scene: scene,
        font: font,
        fontSize: 20,
        text: "参加する",
        textColor: "black",
        local: true,
    }));
    entryButton.x = (g.game.width / 2) - (entryButton.width / 2);
    entryButton.y = g.game.height - (entryButton.height * 2);
    entryButton.modified();

    entryButton.pointDown.add(() => {
        scene.remove(entryButton);

        // このボタンの処理は押した人でしか発生しないので、ゲーム全体の進行のため通知する
        g.game.raiseEvent(new g.MessageEvent({message: "Entry"}));
    });

    // -----------------------------------------------------------


    function onGameMasterArrive() {
        // 自分のIDがゲームマスターIDかどうかで分岐
        if (g.game.selfId === gameMasterId) {
            scene.append(closeButton);
            infoLabel.text = "あなたが一番最初にjoinしました。あなたが放送者です。\n参加者の受付を終了することができます";
            infoLabel.invalidate();
        } else {
            scene.append(entryButton);
            infoLabel.text = "あなたは視聴者です。ゲームに参加することができます。";
            infoLabel.invalidate();
        }
    }

    function onPlayStart() {
        let text = "ゲーム開始。5秒ほどで終了し、また募集に戻ります";
        if (gameMasterId === g.game.selfId) {
            text += "\nあなたは放送者です。";
        } else {
            if (players.indexOf(g.game.selfId) < 0) {
                text += "\nあなたは今回参加しませんでした";
            } else {
                text += "\nあなたは今回参加しました";
            }
        }

        if (players.length === 0) {
            text += "\n参加者はいませんでした";
        } else {
            text += "\n今回の参加者";
            players.forEach((id: string) => {
                text += `\nID:${id}さん`;
            });
        }

        infoLabel.text = text;
        infoLabel.invalidate();
    }

    // 毎フレーム呼び出される処理。ゲームステータスで分岐する
    function mainLoop() {
        if (gameStatus === "gameMasterWaiting") {
            if (gameMasterId !== null) {
                onGameMasterArrive();
                gameStatus = "initializing";
            }
        }

        if (gameStatus === "initializing") {
            players = [];
            timer = 30 * 5;
            gameStatus = "waiting";
        }

        if (gameStatus === "playStarting") {
            onPlayStart();
            gameStatus = "playing";
        }

        if (gameStatus === "playing") {
            timer--;
            if (timer <= 0) {
                onGameMasterArrive();
                gameStatus = "initializing";
            }
        }
    }

    scene.update.add(mainLoop);


    // raiseEventを処理するところ。raiseEvent時につけたmessage名で処理を分岐する
    scene.message.add((ev: g.MessageEvent) => {
        if (ev.data.message === "EntryClosed") {
            // 募集締め切り
            gameStatus = "playStarting";

            // 参加者が参加ボタンを押さなかった場合参加ボタンが残っているので消しとく
            scene.remove(entryButton);
        }

        if (ev.data.message === "Entry") {
            const playerId = ev.player.id;
            if (players.indexOf(playerId) < 0) {
                players.push(playerId);
            }

            // エントリーしたのが自分だった時
            if (playerId === g.game.selfId) {
                infoLabel.text = "あなたは参加しました。\n放送者の受付終了を待っています";
                infoLabel.invalidate();
            }
        }
    });
}

export = main;
