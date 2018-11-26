import { playAnimation, stopAnimation, animationPlaying, renderBG, external, render, highlightSpaces } from "./renderer";
import * as React from "react";
import { addAnimBG, removeAnimBG, setBG, IBoard, getDeadEnds, currentBoardIsROM } from "./boards";
import { openFile } from "./utils/input";
import { BoardType, View } from "./types";
import { $$log } from "./utils/debug";
import { changeView } from "./appControl";

interface IBoardPropertiesProps {
  currentBoard: IBoard;
}

export class BoardProperties extends React.Component<IBoardPropertiesProps> {
  state = { }

  render() {
    let gameVersion = this.props.currentBoard.game;
    let romBoard = currentBoardIsROM();

    let animationBGList;
    if (gameVersion === 2) {
      animationBGList = (
        <AnimationBGList board={this.props.currentBoard} />
      )
    }

    let deadEndCheck;
    if (!romBoard) {
      deadEndCheck = (
        <CheckDeadEnds board={this.props.currentBoard} />
      );
    }

    return (
      <div className="properties">
        <EditDetails romBoard={romBoard} />
        <BGSelect gameVersion={gameVersion} boardType={this.props.currentBoard.type} />
        {deadEndCheck}
        {animationBGList}
      </div>
    );
  }
};

interface IBGSelectProps {
  gameVersion: number;
  boardType: BoardType;
}

const BGSelect = class BGSelect extends React.Component<IBGSelectProps> {
  state = { }

  onChangeBg = () => {
    openFile("image/*", this.bgSelected);
  }

  bgSelected = (event: any) => {
    let file = event.target.files[0];
    if (!file)
      return;

    let reader = new FileReader();
    reader.onload = error => {
      setBG(reader.result);
      render();
    };
    reader.readAsDataURL(file);
  }

  render() {
    let title;
    switch (this.props.gameVersion) {
      case 1:
        title = "960 x 720";
        break;
      case 2:
      case 3:
        if (this.props.boardType === BoardType.DUEL)
          title = "896 x 672";
        else
          title = "1152 x 864";
        break;
    }

    return (
      <div className="propertiesActionButton" onClick={this.onChangeBg} title={title}>
        <img src="img/header/setbg.png" className="propertiesActionButtonImg" width="24" height="24" />
        <span className="propertiesActionButtonSpan">Change main background</span>
      </div>
    );
  }
};

interface IEditDetailsProps {
  romBoard: boolean;
}

const EditDetails = class EditDetails extends React.Component<IEditDetailsProps> {
  state = { }

  onEditDetails() {
    changeView(View.DETAILS);
  }

  render() {
    let text = this.props.romBoard ? "View board details" : "Edit board details";
    return (
      <div className="propertiesActionButton" onClick={this.onEditDetails}>
        <img src="img/header/editdetails.png" className="propertiesActionButtonImg" width="24" height="24" />
        <span className="propertiesActionButtonSpan">{text}</span>
      </div>
    );
  }
};

interface ICheckDeadEndsProps {
  board: IBoard;
}

class CheckDeadEnds extends React.Component<ICheckDeadEndsProps> {
  private _noDeadEndsTimeout: any;

  state = {
    noDeadEnds: false, // Set to true briefly after running
  }

  checkForDeadEnds = () => {
    const deadEnds = getDeadEnds(this.props.board);
    $$log("Dead ends", deadEnds);

    if (deadEnds.length) {
      highlightSpaces(deadEnds);
    }
    else {
      this.setState({ noDeadEnds: true });
      this._noDeadEndsTimeout = setTimeout(() => {
        delete this._noDeadEndsTimeout;
        this.setState({ noDeadEnds: false });
      }, 1000);
    }
  }

  componentWillUnmount() {
    if (this._noDeadEndsTimeout) {
      delete this._noDeadEndsTimeout;
      clearTimeout(this._noDeadEndsTimeout);
    }
  }

  render() {
    let text, handler;
    if (this.state.noDeadEnds) {
      text = "✓ No dead ends";
    }
    else {
      text = "Check for dead ends";
      handler = this.checkForDeadEnds;
    }
    return (
      <div className="propertiesActionButton" onClick={handler}>
        <img src="img/editor/boardproperties/deadend.png" className="propertiesActionButtonImg" width="24" height="24" />
        <span className="propertiesActionButtonSpan">{text}</span>
      </div>
    );
  }
};

interface IAnimationBGListProps {
  board: IBoard;
}

const AnimationBGList = class AnimationBGList extends React.Component<IAnimationBGListProps> {
  state = { }

  onAnimBgsChanged = () => {
    this.forceUpdate();
  }

  render() {
    let bgs = this.props.board.animbg || [];
    let i = 0;
    let entries = bgs.map((bg: string) => {
      i++;
      return (
        <AnimationBGEntry bg={bg} text={"Frame " + i} key={i} index={i-1}
          onAnimBgsChanged={this.onAnimBgsChanged} />
      );
    });

    let playButton;
    if (bgs.length) {
      playButton = (
        <AnimationPlayButton />
      );
    }

    return (
      <div className="propertiesAnimationBGList">
        <span className="propertySectionTitle">
          Animation Backgrounds
          {playButton}
        </span>
        {entries}
        <AnimationBGAddButton onAnimBgsChanged={this.onAnimBgsChanged} />
      </div>
    );
  }
};

interface IAnimationBGEntryProps {
  bg: string;
  index: number;
  text: string;
  onAnimBgsChanged(): any;
}

class AnimationBGEntry extends React.Component<IAnimationBGEntryProps> {
  state = { }

  onMouseDown = () => {
    if (!animationPlaying())
      external.setBGImage(this.props.bg);
  }

  restoreMainBG = () => {
    if (!animationPlaying())
      renderBG();
  }

  onRemove = () => {
    removeAnimBG(this.props.index);
    this.props.onAnimBgsChanged();
  }

  render() {
    return (
      <div className="propertiesActionButton" onMouseDown={this.onMouseDown} onMouseUp={this.restoreMainBG} onMouseOut={this.restoreMainBG}>
        <img src={this.props.bg} className="propertiesActionButtonImg" width="24" height="24" />
        <span className="propertiesActionButtonSpan">{this.props.text}</span>
        <div role="button" className="animBGEntryDelete" onClick={this.onRemove}
          title="Remove this animation frame">✖</div>
      </div>
    );
  }
};

interface IAnimationBGAddButtonProps {
  onAnimBgsChanged(): any;
}

class AnimationBGAddButton extends React.Component<IAnimationBGAddButtonProps> {
  state = { }

  onAddAnimBg = () => {
    openFile("image/*", this.bgSelected);
  }

  bgSelected = (event: any) => {
    let file = event.target.files[0];
    if (!file)
      return;

    let reader = new FileReader();
    reader.onload = error => {
      addAnimBG(reader.result);
      this.props.onAnimBgsChanged();
    };
    reader.readAsDataURL(file);
  }

  render() {
    return (
      <div className="propertiesActionButton" onClick={this.onAddAnimBg}>
        <img src="img/toolbar/animadd.png" className="propertiesActionButtonImg" width="24" height="24" />
        <span className="propertiesActionButtonSpan">Add background</span>
      </div>
    );
  }
};

interface IAnimationPlayButtonState {
  playing: boolean;
}

const AnimationPlayButton = class AnimationPlayButton extends React.Component<{}, IAnimationPlayButtonState> {
  constructor(props: {}) {
    super(props);

    this.state = {
      playing: animationPlaying()
    }
  }

  render() {
    let icon = this.state.playing ? "▮▮" : "►";
    return (
      <div className="animPlayBtn" onClick={this.onClick}>{icon}</div>
    );
  }

  onClick = () => {
    this.setState({ playing: !this.state.playing });

    if (!this.state.playing)
      playAnimation();
    else
      stopAnimation();
  }

  componentWillUnmount() {
    stopAnimation();
  }
};