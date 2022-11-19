import "./index.css";

import {
  FileBlockProps,
  FileContext,
  getLanguageFromFilename,
} from "@githubnext/blocks";
import "./index.css";
import Editor, { useMonaco, Monaco } from "@monaco-editor/react";
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
import * as lsp from "vscode-languageserver-types";
import * as zip from "@zip.js/zip.js";

let getDirName = (file: string) => {
  let parts = file.split("/");
  parts.pop();
  return parts.join("/");
};

let pathJoin = (...parts: string[]) => {
  let separator = "/";
  let np = parts.map((p) => (p.startsWith(separator) ? p.substring(1) : p));
  return np.join(separator);
};

let DEBUG = true;
let logger = DEBUG ? console.log : () => {};

const rawUrl = "https://raw.githubusercontent.com";
const getUrl = (repo: string, file: string, branch: string) =>
  `${rawUrl}${repo}/${branch}/${file}`;
let lsifReader = new LsifReader();

let workspaceRoot = () => {
  let wr = lsifReader.getWorkspaceRoot();
  if (wr) {
    return wr.endsWith(".toml") ? getDirName(wr) : wr;
  }
  return undefined;
};

const hoverProvider: languages.HoverProvider = {
  provideHover: (
    model: editor.ITextModel,
    position: Position,
    token: any
  ): languages.ProviderResult<languages.Hover> => {
    logger("hover", model.uri, position);
    let result = lsifReader.hover(model.uri.toString(true), {
      line: position.lineNumber - 1,
      character: position.column - 1,
    });
    if (!result || !result.contents || !result.range) {
      return;
    }
    logger("hover result", result);

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

let mapLocation = (
  modelUri: Uri,
  workspaceRoot: string | undefined,
  l: lsp.Location
): languages.Location => {
  let range = {
    startLineNumber: l.range.start.line + 1,
    startColumn: l.range.start.character + 1,
    endLineNumber: l.range.end.line + 1,
    endColumn: l.range.end.character + 1,
  };
  let uri =
    workspaceRoot === undefined
      ? modelUri
      : l.uri.startsWith(workspaceRoot)
      ? Uri.file(l.uri.substring(workspaceRoot.length))
      : modelUri;

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
  let ds: languages.DocumentSymbol = {
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
    logger("Hover res", result);
    if (!result) {
      return;
    }

    let wr = workspaceRoot();

    let locations =
      result instanceof Array
        ? result.map((l) => mapLocation(model.uri, wr, l))
        : [mapLocation(model.uri, wr, result)];

    logger("definitionProvider", locations);
    return locations;
  },
};

let documentSymbolProvider: languages.DocumentSymbolProvider = {
  provideDocumentSymbols: (
    model: editor.ITextModel,
    token: CancellationToken
  ): languages.ProviderResult<languages.DocumentSymbol[]> => {
    logger("provideDocumentSymbols");
    let symbols = lsifReader.documentSymbols(model.uri.toString(true));
    logger(symbols);
    if (!symbols) {
      return;
    }

    let result = symbols.map((s) => {
      return mapDocumentSymbol(s);
    });

    return result;
  },
};

let referencesProvider: languages.ReferenceProvider = {
  provideReferences: (
    model: editor.ITextModel,
    position: Position,
    context: languages.ReferenceContext,
    token: any
  ): languages.ProviderResult<languages.Location[]> => {
    logger("provideReferences", context);
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

    let wr = workspaceRoot();

    let locations =
      result instanceof Array
        ? result.map((l) => mapLocation(model.uri, wr, l))
        : [mapLocation(model.uri, wr, result)];

    logger("REF locations", locations);
    return locations;
  },
};

let highlightProvider: languages.DocumentHighlightProvider = {
  provideDocumentHighlights: (
    model: editor.ITextModel,
    position: Position,
    token: any
  ): languages.ProviderResult<languages.DocumentHighlight[]> => {
    let result = lsifReader.references(
      model.uri.toString(true),
      {
        line: position.lineNumber - 1,
        character: position.column - 1,
      },
      { includeDeclaration: true }
    );
    if (!result) {
      return;
    }

    let wr = workspaceRoot();
    let locations =
      result instanceof Array
        ? result.map((l) => mapLocation(model.uri, wr, l))
        : [mapLocation(model.uri, wr, result)];
    return locations.map((l) => {
      return {
        range: l.range,
        kind: languages.DocumentHighlightKind.Text,
      };
    });
  },
};

let transformerFactory = (context: FileContext): UriTransformer => {
  return {
    toDatabase: (_uri) => {
      logger("toDatabase", _uri);
      let wr = workspaceRoot();
      if (!wr) {
        return _uri;
      }
      let uri = Uri.parse(_uri);
      let result = pathJoin(wr, uri.path);
      logger("toDatabase", result);
      return result;
    },
    fromDatabase: (uri) => {
      return uri;
    },
  };
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
      monaco.languages.registerDocumentSymbolProvider(
        "*",
        documentSymbolProvider
      );
      monaco.languages.registerDocumentHighlightProvider(
        "*",
        highlightProvider
      );
      inited = true;
    }
  }, [monaco]);

  let beforeMountHandler = async (monaco: Monaco, context: FileContext) => {
    const WORKFLOW_NAME = "LSIF";
    const ARTIFACT_NAME = "index.lsif";

    const indexUrl = getUrl(
      "/" + context.owner + "/" + context.repo,
      "index.lsif",
      "lsif-index"
    );

    type WorkflowRespone = {
      total_count: number;
      workflows: { name: string; id: string }[];
    };
    let workflows: WorkflowRespone = await props.onRequestGitHubData(
      `/repos/${props.context.owner}/${props.context.repo}/actions/workflows`
    );
    let wf = workflows.workflows.find((w) => w.name === WORKFLOW_NAME);
    if (!wf) {
      return;
    }

    type RunsResponse = {
      total_count: number;
      workflow_runs: { id: string; status: string }[];
    };
    let runs: RunsResponse = await props.onRequestGitHubData(
      `/repos/${props.context.owner}/${props.context.repo}/actions/workflows/${wf.id}/runs`,
      {
        branch: "main", //context.branch,
        status: "completed",
        head_sha: context.sha, // TODO: handle HEAD?
      }
    );
    let run;
    if (runs.total_count === 0) {
      let runs: RunsResponse = await props.onRequestGitHubData(
        `/repos/${props.context.owner}/${props.context.repo}/actions/workflows/${wf.id}/runs`,
        {
          branch: "main", //context.branch,
          status: "completed",
        }
      );

      if (runs.total_count === 0) {
        logger("No runs found");
        return;
      }
      run = runs.workflow_runs[0];
    } else {
      run = runs.workflow_runs[0];
    }

    type ArtifactResponse = {
      total_count: number;
      artifacts: { id: string; name: string; archive_download_url: string }[];
    };
    let artifacts: ArtifactResponse = await props.onRequestGitHubData(
      `/repos/${props.context.owner}/${props.context.repo}/actions/runs/${run.id}/artifacts`
    );
    let artifact = artifacts.artifacts.find((a) => a.name === ARTIFACT_NAME);
    if (!artifact) {
      logger("No artifact found");
      return;
    }
    let zipFileBlob: Blob = await props.onRequestGitHubData(
      `/repos/${props.context.owner}/${props.context.repo}/actions/artifacts/${artifact.id}/zip`,
      undefined,
      true
    );
    const zipFileReader = new zip.BlobReader(zipFileBlob);

    const artifactContentWriter = new zip.TextWriter();
    const zipReader = new zip.ZipReader(zipFileReader);
    const firstEntry = (await zipReader.getEntries()).shift();
    if (firstEntry) {
      const lsifText = await firstEntry.getData(artifactContentWriter);
      lsifReader.load(lsifText, (wr) => transformerFactory(context));
    } else {
      logger("No LSIF data found");
    }

    await zipReader.close();
  };

  const onMountHandler = (e: any, monaco: Monaco) => {
    const editorService = e._codeEditorService;
    const openEditorBase = editorService.openCodeEditor.bind(editorService);

    editorService.openCodeEditor = async (input: any, source: any) => {
      const result = await openEditorBase(input, source);
      if (result === null) {
        logger("Open definition for:", input);
        let uri = input.resource as Uri;

        //navigate to input selection on given model
        let navigate = (model: editor.ITextModel) => {
          e.revealRangeInCenterIfOutsideViewport(
            {
              startLineNumber: input.options.selection.startLineNumber,
              endLineNumber: input.options.selection.endLineNumber,
              startColumn: input.options.selection.startColumn,
              endColumn: input.options.selection.endColumn,
            },
            editor.ScrollType.Smooth
          );
          let word = model.getWordAtPosition({
            lineNumber: input.options.selection.startLineNumber,
            column: input.options.selection.startColumn,
          });
          if (word) {
            e.setSelection(
              {
                startLineNumber: input.options.selection.startLineNumber,
                endLineNumber: input.options.selection.endLineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
              },
              source
            );
          } else {
            e.setSelection({
              startLineNumber: input.options.selection.startLineNumber,
              endLineNumber: input.options.selection.endLineNumber,
              startColumn: input.options.selection.startColumn,
              endColumn: input.options.selection.endColumn,
            }),
              source;
          }
        };

        //Blocks navigation forces reload, I don't think we want that
        // let path = uri.path.startsWith("/")
        //   ? uri.path.substring(1)
        //   : uri.path;
        // props.onNavigateToPath(path);
        let model = monaco.editor.getModel(uri);
        if (model) {
          e.setModel(model);
          navigate(model);
        } else {
          let url = getUrl(
            "/" + context.owner + "/" + context.repo,
            uri.path,
            "main" //TODO: Context doesn't have branch
          );
          let res = await fetch(url);
          let text = await res.text();
          let model = monaco.editor.createModel(text, language, uri);
          e.setModel(model);
          navigate(model);
        }
      }
      return result;
    };
  };

  return (
    <Editor
      height="100vh"
      defaultLanguage={language}
      defaultValue={content}
      options={{
        readOnly: true,
      }}
      path={context.path}
      beforeMount={async (monaco: Monaco) =>
        beforeMountHandler(monaco, context)
      }
      onMount={onMountHandler}
    />
  );
}
