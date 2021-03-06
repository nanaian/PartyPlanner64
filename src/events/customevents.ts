import { IEvent, IEventWriteInfo, IEventParameter } from "./events";
import { getSavedEvents } from "../utils/localstorage";
import { $$log } from "../utils/debug";
import { copyRange } from "../utils/arrays";
import { getGameName, Game, getExecutionTypeByName, EventParameterTypes, EventParameterType, EventCodeLanguage, EditorEventActivationType } from "../types";
import { assemble } from "mips-assembler";
import { prepAsm } from "./prepAsm";
import { IEventInstance } from "../boards";
import { addEventToLibrary } from "./EventLibrary";
import { compile } from "../utils/c-compiler";
import { prepC } from "./prepC";

export interface ICustomEvent extends IEvent {
  asm: string;
}

export const CustomAsmHelper = {
  readDiscreteProperty: function(asm: string, propName: string) {
    const regex = new RegExp("^\\s*[;\\/]+\\s*" + propName + ":(.+)$", "gim");
    let regexMatch = regex.exec(asm);
    if (regexMatch) {
      return regexMatch[1];
    }
    return null;
  },

  readDiscretePropertySet: function(asm: string, propName: string) {
    const regex = new RegExp("^\\s*[;\\/]+\\s*" + propName + ":(.+)$", "gim");
    let lastFind = null;
    const matches = [];
    do {
      lastFind = regex.exec(asm);
      if (lastFind) {
        matches.push(lastFind[1].trim());
      }
    } while (lastFind);
    return matches;
  },

  clearDiscreteProperties(asm: string, properties: string[]) {
    properties.forEach(propertyName => {
      const regex = new RegExp("^\\s*[;\\/]+\\s*" + propertyName + ":.*[\r\n]*", "gim");
      asm = asm.replace(regex, "");
    });
    return asm;
  },

  writeDiscreteProperty(asm: string, propName: string, value: string, commentChar: string) {
    return `${commentChar} ${propName}: ${value}\n` + asm;
  },

  writeDiscretePropertyArray(asm: string, propName: string, values: string[], commentChar: string) {
    for (let i = values.length - 1; i >= 0; i--) {
      asm = `${commentChar} ${propName}: ${values[i]}\n` + asm;
    }
    return asm;
  },

  readSupportedGames: function(asm: string): Game[] | null {
    let value = CustomAsmHelper.readDiscreteProperty(asm, "GAMES");
    if (value !== null) {
      let ids: string[] = value.trim().split(",");
      const supportedGames = [];
      for (let i = 0; i < ids.length; i++) {
        let id = ids[i];
        if ((Game as any)[id]) {
          supportedGames.push((Game as any)[id]);
        }
      }
      return supportedGames;
    }
    return null;
  },

  readExecutionType: function(asm: string) {
    let value = CustomAsmHelper.readDiscreteProperty(asm, "EXECUTION");
    if (value) {
      return getExecutionTypeByName(value.trim());
    }
  },

  readParameters: function(asm: string) {
    const entryStrings = CustomAsmHelper.readDiscretePropertySet(asm, "PARAM");
    const parameters: IEventParameter[] = [];
    entryStrings.forEach(entryStr => {
      const pieces = entryStr.split("|");
      if (pieces.length !== 2)
        return;
      const parameter: IEventParameter = {
        name: pieces[1],
        type: pieces[0] as EventParameterType // hopefully
      };
      try {
        CustomAsmHelper.validateParameters([parameter]);
        parameters.push(parameter);
      }
      catch (e) {} // It's invalid, just skip it.
    });
    return parameters;
  },

  validParameterNameRegex: /^[\w?!]*$/,

  validateParameters: function(parameters: IEventParameter[]) {
    if (!parameters)
      return;
    parameters.forEach(parameter => {
      if (!parameter.name)
        throw new Error("An event parameter didn't have a name");
      if (!parameter.type)
        throw new Error("An event parameter didn't have a type");
      if (!parameter.name.match(CustomAsmHelper.validParameterNameRegex))
        throw new Error(`Event parameter name '${parameter.name}' is not valid`);
      if (EventParameterTypes.indexOf(parameter.type) === -1)
        throw new Error(`Event parameter type ${parameter.type} is not recognized`);
    });
  },

  testCustomEvent: async function(lang: EventCodeLanguage, code: string, parameters?: IEventParameter[], info: Partial<IEventWriteInfo> = {}) {
    switch (lang) {
      case EventCodeLanguage.MIPS:
        return CustomAsmHelper.testAssemble(code, parameters, info);

      case EventCodeLanguage.C:
        return CustomAsmHelper.testCompile(code, parameters, info);

      default:
        throw new Error(`Unrecognized event code language: ${lang}`);
    }
  },

  /** Does a test assembly of a custom event. */
  testAssemble: function(asm: string, parameters?: IEventParameter[], info: Partial<IEventWriteInfo> = {}): ArrayBuffer {
    const parameterValues = _makeFakeParameterValues(parameters);

    const customEvent = createCustomEvent(EventCodeLanguage.MIPS, asm);
    const preppedAsm = prepAsm(asm, customEvent, { parameterValues } as IEventInstance, Object.assign({
      addr: 0,
    }, info) as IEventWriteInfo);
    const bytes = assemble(preppedAsm) as ArrayBuffer;
    return bytes;
  },

  testCompile: async function(code: string, parameters?: IEventParameter[], info: Partial<IEventWriteInfo> = {}) {
    const parameterValues = _makeFakeParameterValues(parameters);

    const customEvent = createCustomEvent(EventCodeLanguage.C, code);
    const preppedC = prepC(code, customEvent, { parameterValues } as IEventInstance, info as IEventWriteInfo);

    const asm = await compile(preppedC);
    $$log(asm);

    const preppedAsm = prepAsm(asm, customEvent, {} as IEventInstance, Object.assign({
      addr: 0,
    }, info) as IEventWriteInfo);
    assemble(preppedAsm);

    return asm;
  },
};

function _makeFakeParameterValues(parameters?: IEventParameter[]): any {
  const parameterValues: any = {};
  if (parameters && parameters.length) {
    parameters.forEach(parameter => {
      parameterValues[parameter.name] = 0;
    });
  }
  return parameterValues;
}

/** Creates a custom event object from a code string. */
export function createCustomEvent(language: EventCodeLanguage, code: string) {
  let eventName = CustomAsmHelper.readDiscreteProperty(code, "NAME");
  if (!eventName || !eventName.trim()) {
    throw new Error("Custom event must have a name");
  }
  eventName = eventName.trim();
  const eventId = eventName;

  const executionType = CustomAsmHelper.readExecutionType(code);
  if (!executionType) {
    throw new Error("Custom event must have execution type");
  }

  const supportedGames = CustomAsmHelper.readSupportedGames(code);
  if (!supportedGames) {
    throw new Error("Custom event must have supported games list");
  }

  const parameters = CustomAsmHelper.readParameters(code);
  const custEvent: ICustomEvent = {
    id: eventId,
    name: eventName,
    custom: true,
    language,
    asm: code,
    activationType: EditorEventActivationType.LANDON,
    executionType: executionType,
    supportedGames: supportedGames,
    parameters: parameters,
  };

  //$$log("New custom event", custEvent);
  return custEvent;
}

export async function validateCustomEvent(event: ICustomEvent): Promise<boolean> {
  const { language, parameters, supportedGames } = event;

  if (parameters) {
    CustomAsmHelper.validateParameters(parameters);
  }

  const code = event.asm;

  // Test that assembly works in all claimed supported versions.
  for (let i = 0; i < supportedGames.length; i++) {
    const game = supportedGames[i];
    try {
      await CustomAsmHelper.testCustomEvent(language!, code, parameters, { game });
    }
    catch (e) {
      const errorMsg = "Failed a test compile/assembly for " + getGameName(game)
      + ". The event code may need adjustments before it can be used.\n\n" + e.toString();
      console.error(errorMsg + "\n\n" + code)
      throw new Error(errorMsg);
    }
  }

  return true;
}

export async function writeCustomEvent(dataView: DataView, spaceEvent: IEventInstance,
  info: IEventWriteInfo, lang: EventCodeLanguage, code: string, temp: any) {
  $$log("Writing custom event", spaceEvent, info);

  const customEvent = createCustomEvent(lang, code);

  if (lang === EventCodeLanguage.C) {
    const preppedC = prepC(code, customEvent, spaceEvent, info);
    code = await compile(preppedC);
  }

  if (info.gameVersion !== 2) {
    return code;
  }

  const preppedAsm = prepAsm(code, customEvent, spaceEvent, info);
  const bytes = assemble(preppedAsm) as ArrayBuffer;
  $$log(preppedAsm);
  copyRange(dataView, bytes, 0, 0, bytes.byteLength);
  return [info.offset!, bytes.byteLength];
}

// Yes, right here, load cached events...
const cachedEvents = getSavedEvents();
if (cachedEvents && cachedEvents.length) {
  cachedEvents.forEach((eventObj: IEvent) => {
    if (!eventObj || !(eventObj as ICustomEvent).asm)
      return;
    try {
      const customEventObj = eventObj as ICustomEvent;
      const customEvent = createCustomEvent(
        customEventObj.language || EventCodeLanguage.MIPS,
        customEventObj.asm
      );
      addEventToLibrary(customEvent);
    }
    catch (e) {
      // Just let the error slide, event format changed or something?
      console.error("Error reading cached event: " + e.toString());
    }
  });
}
