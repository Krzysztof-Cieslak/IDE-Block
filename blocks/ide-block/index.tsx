import "./index.css";

import {
  FileBlockProps,
  FileContext,
  getLanguageFromFilename,
} from "@githubnext/blocks";
import "./index.css";
import Editor, {
  useMonaco,
  Monaco,
} from "@monaco-editor/react";
import {
  CancellationToken,
  editor,
  IMarkdownString,
  languages,
  Position,
  Uri,
  IRange,
} from "monaco-editor";
import { useEffect } from "react";
import { LsifReader, UriTransformer } from "@ionide/lsif-reader";

const rawUrl = "https://raw.githubusercontent.com";
const getUrl = (repo: string, file: string, branch: string) =>
  `${rawUrl}${repo}/${branch}/${file}`;
let lsifReader = new LsifReader();

const hoverProvider: languages.HoverProvider = {
  provideHover: (
    model: editor.ITextModel,
    position: Position,
    token: any
  ): languages.ProviderResult<languages.Hover> => {
    let result = lsifReader.hover(model.uri.toString(true), {
      line: position.lineNumber - 1,
      character: position.column - 1,
    });
    if (!result || !result.contents || !result.range) {
      return;
    }
    let contents: IMarkdownString[];
    if (typeof result.contents === "string") {
      contents = [{ value: result.contents }];
    } else if ("kind" in result.contents || "value" in result.contents) {
      contents = [{ value: result.contents.value }];
    } else {
      contents = result.contents.map((c) =>
        typeof c === "string" ? { value: c } : { value: c.value }
      );
    }

    const range = {
      startLineNumber: result.range.start.line,
      startColumn: result.range.start.character,
      endLineNumber: result.range.end.line,
      endColumn: result.range.end.character,
    };
    return {
      range,
      contents: contents,
    };
  },
};

let mapLocation = (uri: Uri, l: any): languages.Location => {
  let range = {
    startLineNumber: l.range.start.line + 1,
    startColumn: l.range.start.character + 1,
    endLineNumber: l.range.end.line + 1,
    endColumn: l.range.end.character + 1,
  };
  return { uri: uri, range: range };
};

let mapRange = (l: any): IRange => {
  return {
    startLineNumber: l.range.start.line + 1,
    startColumn: l.range.start.character + 1,
    endLineNumber: l.range.end.line + 1,
    endColumn: l.range.end.character + 1,
  };
};

let mapDocumentSymbol = (s: any): languages.DocumentSymbol => {
  let ds : languages.DocumentSymbol = {
    name: s.name,
    detail: s.detail,
    kind: s.kind,
    tags: s.tags,
    range: mapRange(s.range),
    selectionRange: mapRange(s.selectionRange),
  };
  return ds;
};

let definitionProvider: languages.DefinitionProvider = {
  provideDefinition: (
    model: editor.ITextModel,
    position: Position,
    token: any
  ): languages.ProviderResult<languages.Definition> => {
    let result = lsifReader.definitions(model.uri.toString(true), {
      line: position.lineNumber - 1,
      character: position.column - 1,
    });
    if (!result) {
      return;
    }

    let locations =
      result instanceof Array
        ? result.map((l) => mapLocation(model.uri, l))
        : [mapLocation(model.uri, result)];
    return locations;
  },
};

let documentSymbolProvider: languages.DocumentSymbolProvider = {
  provideDocumentSymbols: (model: editor.ITextModel, token: CancellationToken): languages.ProviderResult<languages.DocumentSymbol[]> => {
    console.log("provideDocumentSymbols");
    let symbols = lsifReader.documentSymbols(model.uri.toString(true));
    console.log(symbols);
    if (!symbols) {
      return;
    }

    let result = symbols.map((s) => {
      return mapDocumentSymbol(s);
    });


    return result;
  }
}

let referencesProvider: languages.ReferenceProvider = {
  provideReferences: (
    model: editor.ITextModel,
    position: Position,
    context: languages.ReferenceContext,
    token: any
  ): languages.ProviderResult<languages.Location[]> => {
    let result = lsifReader.references(
      model.uri.toString(true),
      {
        line: position.lineNumber - 1,
        character: position.column - 1,
      },
      context
    );
    if (!result) {
      return;
    }

    let locations =
      result instanceof Array
        ? result.map((l) => mapLocation(model.uri, l))
        : [mapLocation(model.uri, result)];
    return locations;
  },
};

let getDirName = (file: string) => {
  let parts = file.split("/");
  parts.pop();
  return parts.join("/");
};

let pathJoin = (...parts: string[]) => {
  return parts.join("/");
};

let transformerFactory = (
  workspaceRoot: string | undefined,
  context: FileContext
): UriTransformer => {
  return {
    toDatabase: (_uri) => {
      workspaceRoot = workspaceRoot?.endsWith(".toml")
        ? getDirName(workspaceRoot)
        : workspaceRoot;
      if (!workspaceRoot) {
        return _uri;
      }
      let result = pathJoin(workspaceRoot, context.path);
      return result;
    },
    fromDatabase: (uri) => {
      return uri;
    },
  };
};

let beforeMountHandler = async (monaco: Monaco, context: FileContext) => {
  const indexUrl = getUrl(
    "/" + context.owner + "/" + context.repo,
    "index.lsif",
    "lsif-index"
  );
  let res = await fetch(indexUrl);
  let text = await res.text();
  lsifReader.load(text, (wr) => transformerFactory(wr, context));
};

let inited = false;

export default function (props: FileBlockProps) {
  const { context, content, metadata, onUpdateMetadata } = props;
  const language = Boolean(context.path)
    ? context.path.endsWith(".rs")
      ? "rust"
      : context.path.endsWith(".cs")
      ? "csharp"
      : getLanguageFromFilename(context.path).toLowerCase()
    : "N/A";

  const monaco: Monaco | null = useMonaco();

  useEffect(() => {
    if (monaco && !inited) {
      monaco.languages.registerHoverProvider("*", hoverProvider);
      monaco.languages.registerDefinitionProvider("*", definitionProvider);
      monaco.languages.registerReferenceProvider("*", referencesProvider);
      monaco.languages.registerDocumentSymbolProvider("*", documentSymbolProvider);
      inited = true;
    }
  }, [monaco]);

  return (
    <Editor
      height="90vh"
      defaultLanguage={language}
      defaultValue={content}
      options={{
        readOnly: true,
      }}
      beforeMount={async (monaco: Monaco) => {
        return await beforeMountHandler(monaco, context);
      }}
    />
  );
}
