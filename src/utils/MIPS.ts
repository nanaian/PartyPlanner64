import { parse } from "mips-inst";

// MIPS ASM helper library

/* eslint-disable */

export const REG = {
  R0: 0,
  AT: 1,
  V0: 2,
  V1: 3,
  A0: 4,
  A1: 5,
  A2: 6,
  A3: 7,
  T0: 8,
  T1: 9,
  T2: 10,
  T3: 11,
  T4: 12,
  T5: 13,
  T6: 14,
  T7: 15,
  S0: 16,
  S1: 17,
  S2: 18,
  S3: 19,
  S4: 20,
  S5: 21,
  S6: 22,
  S7: 23,
  T8: 24,
  T9: 25,
  K0: 26,
  K1: 27,
  GP: 28,
  SP: 29,
  S8: 30,
  RA: 31
}

export function makeInst(inst: string, ...extras: any[]) {
  if (!arguments.length)
    return null;

  // Oh so sensical V8 optimization.
  let args = new Array(arguments.length - 1);
  for (let i = 1; i < arguments.length; i++)
    args[i - 1] = arguments[i];

  const methodName = "_" + inst.toLowerCase();
  const method = eval(methodName);
  if (typeof method === "function") {
    return method.apply(null, args);
  }

  throw new Error(`MIPS.makeInst: Unrecognized instruction ${inst}`);
}

export function getJALAddr(word: number) {
  if ((word & 0x0C000000) !== 0x0C000000)
    throw new Error(`MIPS.getJALAddr: ${word.toString(16)} is not a JAL instruction.`);

  return (word & 0x03FFFFFF) << 2;
}

export function getRegSetUpperAndLower(address: number) {
  let lower = address & 0x0000FFFF;
  let upper = address >>> 16;
  if (lower & 0x8000)
    upper += 1;
  return [upper, lower];
}

export function getRegSetAddress(upper: number, lower: number) {
  upper = upper & 0x0000FFFF;
  lower = lower & 0x0000FFFF;
  if (lower & 0x8000)
    upper -= 1;
  return ((upper << 16) | lower) & 0x7FFFFFFF;
}

export function getFunctionLength(dataView: DataView, startOffset: number) {
  let offset = startOffset + 4;
  while (dataView.getUint32(offset) !== 0x03E00008 && offset < startOffset + 0x2000) {
    offset += 4;
  }

  if (dataView.getUint32(offset) === 0x03E00008)
    offset += 8;
  else
    return null;

  return offset - startOffset;
}

/**
 * Finds JALs to a given address contained in a DataView.
 * @returns Array of offsets of the JALs.
 */
export function findCalls(dataView: DataView, jalAddr: number) {
  const jalInst = parse(`JAL ${jalAddr}`);
  const calls = [];
  for (let i = 0; i < dataView.byteLength; i += 4) {
    const inst = dataView.getUint32(i);
    if (inst === jalInst) {
      calls.push(i);
    }
  }
  return calls;
}

/**
 * Finds JALs to a given address within the given function.
 * @returns Array of offsets of the JALs.
 */
export function findCallsInFunction(dataView: DataView, startOffset: number, jalAddr: number) {
  const jalInst = parse(`JAL ${jalAddr}`);
  const calls = [];
  for (let i = startOffset; i < dataView.byteLength; i += 4) {
    const inst = dataView.getUint32(i);
    if (inst === 0x03E00008) {
      break;
    }
    if (inst === jalInst) {
      calls.push(i);
    }
  }
  return calls;
}

function _addiu(dst: number, reg: number, imm: number) {
  let base = 0x24000000;
  base = base | reg << 21;
  base = base | dst << 16;
  return base | (imm & 0xFFFF);
}

function _addu(dst: number, reg1: number, reg2: number) {
  let base = 0x00000021;
  base = base | reg1 << 21;
  base = base | reg2 << 16;
  base = base | dst << 11;
  return base;
}

function _beq(r1: number, r2: number, offset: number) {
  let base = 0x10000000;
  base = base | r1 << 21;
  base = base | r2 << 16;
  return base | ((offset >> 2) & 0xFFFF);
}

function _bne(r1: number, r2: number, offset: number) {
  let base = 0x14000000;
  base = base | r1 << 21;
  base = base | r2 << 16;
  return base | ((offset >> 2) & 0xFFFF);
}

function _bgtz(reg: number, offset: number) {
  let base = 0x1C000000;
  base = base | reg << 21;
  return base | ((offset >> 2) & 0xFFFF);
}

function _blez(reg: number, offset: number) {
  let base = 0x18000000;
  base = base | reg << 21;
  return base | ((offset >> 2) & 0xFFFF);
}

function _j(addr: number) {
  let base = 0x08000000;
  return base | (addr >>> 2);
}

function _jr(reg: number) {
  let base = 0x00000008;
  return base | (reg << 21);
}

function _jal(addr: number) {
  let base = 0x0C000000;
  return base | (addr >>> 2);
}

// dst = MEM[reg + offset]
function _lb(dst: number, reg: number, offset: number) {
  let base = 0x80000000;
  base = base | reg << 21;
  base = base | dst << 16;
  return base | (offset & 0xFFFF);
}

// MEM[dst + offset] = (0xff & src);
function _sb(src: number, dst: number, offset: number) {
  let base = 0xA0000000;
  base = base | dst << 21;
  base = base | src << 16;
  return base | (offset & 0xFFFF);
}

// dst = MEM[reg + offset]
function _lh(dst: number, reg: number, offset: number) {
  let base = 0x84000000;
  base = base | reg << 21;
  base = base | dst << 16;
  return base | (offset & 0xFFFF);
}

// MEM[dst + offset] = (0xffff & src);
function _sh(src: number, dst: number, offset: number) {
  let base = 0xA4000000;
  base = base | dst << 21;
  base = base | src << 16;
  return base | (offset & 0xFFFF);
}

function _lui(dst: number, imm: number) {
  let base = 0x3C000000;
  base = base | dst << 16;
  return base | (imm & 0xFFFF);
}

// dst = MEM[reg + offset]
function _lw(dst: number, reg: number, offset: number) {
  let base = 0x8C000000;
  base = base | reg << 21;
  base = base | dst << 16;
  return base | (offset & 0xFFFF);
}

// MEM[reg + offset]
function _sw(src: number, dst: number, offset: number) {
  let base = 0xAC000000;
  base = base | dst << 21;
  base = base | src << 16;
  return base | (offset & 0xFFFF);
}

// r1 = r2 | imm
function _ori(r1: number, r2: number, imm: number) {
  let base = 0x34000000;
  base = base | r1 << 21;
  base = base | r2 << 16;
  return base | (imm & 0xFFFF);
}
