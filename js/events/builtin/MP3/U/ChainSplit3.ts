import { IEvent, IEventParseInfo, IEventWriteInfo } from "../../../events";
import { EventActivationType, EventExecutionType, Game, EventParameterType } from "../../../../types";
import { hashEqual, copyRange } from "../../../../utils/arrays";
import { addConnection, ISpaceEvent } from "../../../../boards";
import { addEventToLibrary } from "../../../EventLibrary";

// Represents the "event" where the player decides between two paths.
// This won't be an actual event when exposed to the user.
export const ChainSplit3: IEvent = {
  id: "CHAINSPLIT3",
  name: "",
  activationType: EventActivationType.WALKOVER,
  executionType: EventExecutionType.PROCESS,
  parameters: [
    { name: "spaceIndexArgs", type: EventParameterType.NumberArray, },
    { name: "chainArgs", type: EventParameterType.NumberArray, }
  ],
  fakeEvent: true,
  supportedGames: [
    Game.MP3_USA,
  ],
  parse(dataView: DataView, info: IEventParseInfo) {
    let hashes = {
      // From Chilly Waters 0x80108D28 / 0x31E898:
      METHOD_START: "16092DD153432852C141C78807ECCBF0", // +0x08
      METHOD_END: "6FF6DF70CDC85862F8F129303009A544", // [0x24]+0x14
    };

    // Match a few sections to see if we match.
    if (hashEqual([dataView.buffer, info.offset, 0x08], hashes.METHOD_START) &&
        hashEqual([dataView.buffer, info.offset + 0x24, 0x14], hashes.METHOD_END)) {
      // Read the RAM offset of the space index arguments.
      let upperAddr = dataView.getUint16(info.offset + 0x0A) << 16;
      let lowerAddr = dataView.getUint16(info.offset + 0x0E);
      let spacesAddr = (upperAddr | lowerAddr) & 0x7FFFFFFF;
      if (spacesAddr & 0x00008000)
        spacesAddr = spacesAddr - 0x00010000;
      let spacesOffset = info.offset - (info.addr - spacesAddr);

      let destinationSpace = dataView.getUint16(spacesOffset);
      while (destinationSpace !== 0xFFFF) {
        addConnection(info.curSpace, destinationSpace, info.board);
        spacesOffset += 2;
        destinationSpace = dataView.getUint16(spacesOffset);
      }

      return true;
    }

    return false;
  },
  write(dataView: DataView, event: ISpaceEvent, info: IEventWriteInfo, temp: any) {
    let endProcessCode = "";
    if (!temp._reverse) {
      endProcessCode = `
        jal   EndProcess
        move  A0, R0
      `;
    }

    const spaceIndexArgs = event.parameterValues!["spaceIndexArgs"] as number[];
    const chainArgs = event.parameterValues!["chainArgs"] as number[];

    return `
    chainSplit3Main:
      addiu SP, SP, -0x18
      sw    RA, 0x10(SP)
      lui   A0, hi(space_index_args)
      addiu A0, A0, lo(space_index_args)
      lui   A1, hi(chain_args)
      addiu A1, A1, lo(chain_args)
      lui   A2, hi(ai_logic)
      jal   chain_split_helper
       addiu A2, A2, lo(ai_logic)
      ${endProcessCode}
      lw    RA, 0x10(SP)
      jr    RA
       addiu SP, SP, 0x18

    chain_split_helper:
      addiu SP, SP, -0x38
      sw    RA, 0x30(SP)
      sw    S5, 0x2c(SP)
      sw    S4, 0x28(SP)
      sw    S3, 0x24(SP)
      sw    S2, 0x20(SP)
      sw    S1, 0x1c(SP)
      sw    S0, 0x18(SP)
      move  S2, A0
      move  S3, A1
      move  S5, A2
      li    A0, -1
      li    A1, -1
      jal   0x800F2304
       li    A2, 2
      jal   SleepVProcess
       move  S1, R0
      jal   setup_arrows
       NOP
      lui   A0, hi(current_player_index)
      jal   GetPlayerStruct
       lb    A0, lo(current_player_index)(A0)
      move  S4, V0
      lbu   A0, 0x15(S4)
      sll   A0, A0, 0x18
      sra   A0, A0, 0x18
      lbu   A1, 0x16(S4)
      sll   A1, A1, 0x18
      sra   A1, A1, 0x18
      andi  A0, A0, 0xffff
      jal   GetAbsSpaceIndexFromChainSpaceIndex
       andi  A1, A1, 0xffff
      sll   V0, V0, 0x10
      sra   A1, V0, 0x10
      li    A2, 2
      move  V1, R0
    L80116514:
      sll   V0, S1, 1
      addu  V0, V0, S1
      sll   V0, V0, 1
      addu  A0, V0, S2
      sll   V0, V1, 1
    L80116528:
      addu  V0, V0, A0
      lh    V0, 0(V0)
      beq   V0, A1, L80116548
       NOP
      addiu V1, V1, 1
      slti  V0, V1, 2
      bnez  V0, L80116528
       sll   V0, V1, 1
    L80116548:
      beq   V1, A2, L80116564
       sll   V0, S1, 1
      addiu S1, S1, 1
      slti  V0, S1, 3
      bnez  V0, L80116514
       move  V1, R0
      sll   V0, S1, 1
    L80116564:
      addu  V0, V0, S1
      sll   A1, V0, 1
      sll   V0, V0, 2
      addu  S3, S3, V0
      lui   S0, hi(current_player_index)
      addiu S0, S0, lo(current_player_index)
      lb    A0, 0(S0)
      jal   0x800D76A0
       addu  A1, S2, A1
      move  S2, V0
      move  A0, S2
      lb    A1, 0(S0)
      jal   0x800D742C
       move  A2, R0
      jal   PlayerIsCPU
       li    A0, -1
      beq  V0, R0, L801165EC
       sll   V0, S1, 2
      addu  V0, V0, S5
      lw    A0, 0(V0)
      jal   0x800DA190
        move  S0, R0
      sll   V0, V0, 0x10
      sra   S1, V0, 0x10
      blez  S1, L801165E4
       move  A0, S2
    L801165CC:
      jal   0x800D7250
       li    A1, -2
      addiu S0, S0, 1
      slt   V0, S0, S1
      bnez  V0, L801165CC
        move  A0, S2
    L801165E4:
      jal   0x800D7250
        li    A1, -4
    L801165EC:
      jal   0x800D7518
       move  A0, S2
      move  S0, V0
      jal   0x800D6CA0
       move  A0, S2
      jal   hide_arrows
       NOP
      bnezl S0, L80116610
       addiu S3, S3, 6
    L80116610:
      lh    A1, 0(S3)
      lh    A2, 2(S3)
      jal   SetNextChainAndSpace
       li    A0, -1
      lh    A1, 4(S3)
      beq  A1, R0, L80116640
       NOP
      li    V0, 1
      beq   A1, V0, L8011664C
       NOP
      j     L80116658
       NOP
    L80116640:
      lbu   V0, 0x17(S4)
      j     L80116654
       andi  V0, V0, 0xfe
    L8011664C:
      lbu   V0, 0x17(S4)
      ori   V0, V0, 1
    L80116654:
      sb    V0, 0x17(S4)
    L80116658:
      lw    RA, 0x30(SP)
      lw    S5, 0x2c(SP)
      lw    S4, 0x28(SP)
      lw    S3, 0x24(SP)
      lw    S2, 0x20(SP)
      lw    S1, 0x1c(SP)
      lw    S0, 0x18(SP)
      jr    RA
       addiu SP, SP, 0x38

    .definelabel CORE_800CDD58,0x800CDD58
    .definelabel CORE_800D51F8,0x800D51F8

    setup_arrows:
      addiu SP, SP, -0x18
      sw    RA, 0x10(SP)
    L8010704C:
      jal   0x800E9AE0
       NOP
      beq  V0, R0, L8010706C
       NOP
      jal   SleepVProcess
       NOP
      j     L8010704C
       NOP
    L8010706C:
      jal   SleepVProcess
       NOP
      move  A0, R0
      li    A1, 146
      jal   0x800E210C
       li    A2, 1
      lui   AT, hi(memval1)
      sw    V0, lo(memval1)(AT)
      li    A0, 1
      li    A1, 160
      jal   0x800E210C
       li    A2, 1
      lui   AT, hi(memval2)
      sw    V0, lo(memval2)(AT)
      li    A0, 13
      li    A1, 174
      jal   0x800E210C
       li    A2, 1
      lui   AT, hi(memval3)
      sw    V0, lo(memval3)(AT)
      li    A0, 3
      li    A1, 188
      jal   0x800E210C
       li    A2, 1
      lui   AT, hi(memval4)
      sw    V0, lo(memval4)(AT)
      li    A0, 11
      li    A1, 202
      jal   0x800E210C
       li    A2, 1
      lui   AT, hi(memval5)
      sw    V0, lo(memval5)(AT)
      jal   SleepProcess
       li    A0, 3
      li    V0, 1
      lui   AT, hi(CORE_800CDD58)
      sh    V0, lo(CORE_800CDD58)(AT)
      lui   AT, hi(CORE_800D51F8)
      sh    V0, lo(CORE_800D51F8)(AT)
      lw    RA, 0x10(SP)
      jr    RA
       addiu SP, SP, 0x18

    hide_arrows:
      addiu SP, SP, -0x18
      sw    RA, 0x10(SP)
      lui   AT, hi(CORE_800CDD58)
      sh    R0, lo(CORE_800CDD58)(AT)
      lui   AT, hi(CORE_800D51F8)
      sh    R0, lo(CORE_800D51F8)(AT)
      lui   A0, hi(memval1)
      jal   0x800E21F4
       lw    A0, lo(memval1)(A0)
      lui   A0, hi(memval2)
      jal   0x800E21F4
       lw    A0, lo(memval2)(A0)
      lui   A0, hi(memval3)
      jal   0x800E21F4
       lw    A0, lo(memval3)(A0)
      lui   A0, hi(memval4)
      jal   0x800E21F4
       lw    A0, lo(memval4)(A0)
      lui   A0, hi(memval5)
      jal   0x800E21F4
       lw    A0, lo(memval5)(A0)
      lw    RA, 0x10(SP)
      jr    RA
       addiu SP, SP, 0x18

      .align 4
      memval1:
        .word 0
      memval2:
        .word 0
      memval3:
        .word 0
      memval4:
        .word 0
      memval5:
        .word 0

      space_index_args:
        .halfword ${spaceIndexArgs.join(", ")}

      chain_args:
        .halfword ${chainArgs.join(", ")}

      ; Choose randomly
      ai_logic:
        .word ai_random_choice, ai_random_choice, ai_random_choice
      ai_random_choice:
        .word 0x00000000, 0x00000000, 0x064C9932
    `;
  }
}
addEventToLibrary(ChainSplit3);
