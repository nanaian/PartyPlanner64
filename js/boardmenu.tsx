namespace PP64.boardmenu {
  interface IBoardMenuProps {
    boards: PP64.boards.IBoard[];
  }

  export class BoardMenu extends React.Component<IBoardMenuProps> {
    render() {
      let boards = this.props.boards.map(function(item, idx) {
        return (
          <Board key={idx} board={item} index={idx} />
        );
      });

      const showRomBoards = PP64.settings.get($setting.uiShowRomBoards);
      let romBoards;
      if (showRomBoards) {
        romBoards = PP64.boards.getROMBoards().map(function(item, idx) {
          return (
            <Board key={"r" + idx} board={item} index={idx} />
          );
        });
      }

      return (
        <div className="boardMenu" role="listbox">
          <div className="boardMenuInner" role="presentation">
            {boards}
            {romBoards}
          </div>
        </div>
      );
    }
  };

  interface IBoardProps {
    board: PP64.boards.IBoard;
    index: number;
  }

  const Board = class Board extends React.Component<IBoardProps> {
    handleClick = () => {
      const boardIsRom = PP64.boards.boardIsROM(this.props.board);
      PP64.boards.setCurrentBoard(this.props.index, boardIsRom);
    }

    onDragStart = (event: any) => {
      // Cannot delete courses that are within the ROM.
      if (PP64.boards.boardIsROM(this.props.board)) {
        event.preventDefault();
        return;
      }

      PP64.utils.drag.showDragZone();
      event.nativeEvent.dataTransfer.setData("text/plain", this.props.index);
      PP64.utils.drag.setDropHandler(function(event: any) {
        event.preventDefault();
        var boardIdx = parseInt(event.dataTransfer.getData("text/plain"));
        if (isNaN(boardIdx))
          return;
        PP64.utils.drag.hideDragZone();
        PP64.boards.deleteBoard(boardIdx);
        PP64.renderer.render();
      });
    }

    onDragEnd = (event: any) => {
      PP64.utils.drag.hideDragZone();
    }

    onRightClick = (event: any) => {
      // Also in BoardOptions...
      event.preventDefault();
      let items = [
        { title: 'Copy', fn: this.onCopyBoard },
        { title: 'Delete', fn: this.onDeleteBoard, visible: !PP64.boards.boardIsROM(this.props.board) },
      ];
      // TODO: In Electron, basicContext is exported some weird place.
      const basicContext = (window as any).basicContext || (window as any).module.exports;
      basicContext.show(items, event.nativeEvent);
    }

    onDeleteBoard = () => {
      PP64.boards.deleteBoard(this.props.index);
      PP64.renderer.render();
    }

    onCopyBoard = () => {
      PP64.boards.copyCurrentBoard();
    }

    render() {
      let tooltip = `Open "${this.props.board.name}"`;
      let className = "boardEntry";
      if (PP64.boards.getCurrentBoard() === this.props.board)
        className += " boardEntryCurrent";
      let boardImg = this.props.board.otherbg.boardlogo || "";
      let imgEl;
      if (boardImg) {
        imgEl = <img className="boardEntryImg" src={boardImg} width="200" height="88" />;
      }
      else {
        imgEl = <div className="boardEntryNoImg" />;
      }

      const boardName = this.props.board.name;
      const boardIsROM = PP64.boards.boardIsROM(this.props.board);
      const onKeyDown = PP64.utils.react.makeKeyClick(this.handleClick, this);
      return (
        <div className={className} title={tooltip} role="option" tabIndex={0}
          onClick={this.handleClick} onKeyDown={onKeyDown} onContextMenu={this.onRightClick}
          draggable onDragStart={this.onDragStart} onDragEnd={this.onDragEnd}>
          {imgEl}
          <BoardROMIcon rom={boardIsROM} />
          <BoardName name={boardName} />
          <BoardOptions rom={boardIsROM}
            onDeleteBoard={this.onDeleteBoard} onCopyBoard={this.onCopyBoard} />
        </div>
      );
    }
  };

  interface IBoardROMIconProps {
    rom: boolean;
  }

  const BoardROMIcon = class BoardROMIcon extends React.Component<IBoardROMIconProps> {
    render() {
      if (!this.props.rom)
        return null;
      return (
        <div className="boardEntryRomIcon" title="Loaded from ROM">
          <img src="img/boardmenu/cart.png" width="26" height="26" />
        </div>
      );
    }
  };

  interface IBoardNameProps {
    name: string;
  }

  class BoardName extends React.Component<IBoardNameProps> {
    state = { "editing": false }

    handleClick = () => {
      this.setState({ "editing": !!this.state.editing });
    }

    render() {
      return (
        <div className="boardName">
          <PP64.texteditor.MPEditor
            value={this.props.name}
            displayMode={PP64.texteditor.MPEditorDisplayMode.Display} />
        </div>
      );
    }
  };

  interface IBoardOptionsProps {
    rom: boolean;
    onCopyBoard: Function;
    onDeleteBoard: Function;
  }

  class BoardOptions extends React.Component<IBoardOptionsProps> {
    handleClick = (event: any) => {
      event.preventDefault();
      let items = [
        { title: 'Copy', fn: this.props.onCopyBoard },
        { title: 'Delete', fn: this.props.onDeleteBoard, visible: !this.props.rom },
        // { title: 'Disabled', icon: 'ion-minus-circled', fn: this.onDeleteOption, disabled: true },
        // { title: 'Invisible', icon: 'ion-eye-disabled', fn: this.onDeleteOption, visible: false },
        // { },
        // { title: 'Logout', icon: 'ion-log-out', fn: this.onDeleteOption }
      ];

      // TODO: In Electron, basicContext is exported some weird place.
      const basicContext = (window as any).basicContext || (window as any).module.exports;
      basicContext.show(items, event.nativeEvent);
    }

    render() {
      return (
        <img className="boardMenuIcon" src="img/boardmenu/options.png" onClick={this.handleClick} />
      );
    }
  };
}