import * as vscode from 'vscode';

let intelliSense: string[] = [];

class GoCompletionItemProvider implements vscode.CompletionItemProvider {

  public provideCompletionItems(
      document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken)
      :Thenable<vscode.CompletionList> {

    try {
      const offset:number = document.offsetAt(position);
      let prefix:string = document.getText().substring(0,offset);
      const symbol:string = document.getText().substring(offset-1,offset);

      /*
      // for the future
      if (symbol === '(') {
        // !!!
        return new Promise<vscode.CompletionList>((resolve, reject) => {
          const completionI = new vscode.CompletionItem('Test');
          completionI.insertText = new vscode.SnippetString('\n{\n\t"task": "Test", \n\t"desc": "${1}"\n}');
          const completionList = new vscode.CompletionList([completionI], false);
          resolve(completionList);
        });
      }
      */
      const dot = '.';
      if (symbol === dot) {

        let typeValues:any[] = [];
        const types = ['TvmCell ', 'TvmSlice ', 'TvmBuilder ', 'uint[] ', 'bytes ', 'string '];
        types.forEach((type:string, i:number) => {
          let phrases = prefix.split(type);

          if (phrases.length > 0) {
            if (type !== prefix.substring(0, type.length)) {
              phrases = phrases.filter((item) => item !== phrases[0]);
            }
          }

          phrases.forEach((phrase:string, j:number) => {
            // console.log(phrase);
            if (phrase.length > 0) {
              const terminals = [';', '=', ' ', '\n'];
              let near:number = prefix.length;
              let fTerminal = '';
              terminals.forEach((terminal:string, n:number) => {
                let variables = phrase.split(terminal);
                if (variables.length > 0) {
                  // console.log(variables[0]);
                  if (near > variables[0].length) {
                    near = variables[0].length;
                    fTerminal = terminal;
                  }
                }
              });
              if (fTerminal !== '') {
                const fVariables = phrase.split(fTerminal);
                // console.log(fVariables[0]);
                typeValues.push({'type': type, 'value': fVariables[0]});
              }
            }
          });
        });

        const lines = prefix.split('\n');
        const lastLine:string = lines[lines.length-1];
        const words = lastLine.split(' ');
        const word = words[words.length-1];

        return new Promise<vscode.CompletionList>((resolve, reject) => {
          let item:any[] = [];
          intelliSense.forEach((itemInS:any) => {

           let bType:boolean = false;
           let bFoundType:boolean = false;
            if (itemInS.type !== undefined && itemInS.type === 1) {
              bType = true;
              /*
              //OLD
              const funcReservedWords = ['msg.', 'tvm.', 'math.', 'tx.', 'block.', 'rnd.'];
              const lastWord = words[words.length-1];
              if (words.length > 1 && words[words.length-1].length > 1 && !funcReservedWords.includes(lastWord)) {
                words.forEach((w:string, i:number) => {
                  if (i < words.length-1 && !bFoundType) {
                    if (w === itemInS.label) {
                      bFoundType = true;
                    }
                  }
                });
              }
              */
              typeValues.forEach((typeValue:any) => {
                if(typeValue.type === itemInS.label+' ' && typeValue.value+dot === word) {
                  bFoundType = true;
                  return;
                }
              });
            }

            if ((word === itemInS.label+dot && !bType) || bFoundType) {
              if (itemInS.data !== undefined && itemInS.data instanceof Array) {
                itemInS.data.forEach((itemData:any) => {
                  const kind:any = vscode.CompletionItemKind[itemData.kind];
                  const completionI = new vscode.CompletionItem(itemData.label, kind);
                  if (itemData.insertText !== undefined) {
                    completionI.insertText = new vscode.SnippetString(itemData.insertText);
                  }
                  completionI.documentation = new vscode.MarkdownString(itemData.documentation);
                  completionI.detail = itemData.detail;
                  // completionI.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger completions...' };
                  item.push(completionI);
                });
              }
            }
          });
          const completionList = new vscode.CompletionList(item, false);
          resolve(completionList);
        });
       } else {
        return new Promise<vscode.CompletionList>((resolve, reject) => {
          resolve();
        });
      }
    } catch(err) {
      console.log('err = ' + err);
      return new Promise<vscode.CompletionList>((resolve, reject) => {
        resolve();
      });
    }
  }
}

export function setupIntelliSense(subscriptions: vscode.Disposable[], intelliSense_: string[]) {
  if (intelliSense_ instanceof Array) {
    intelliSense = intelliSense_;
  }
  // console.log('setupIntelliSense');

  subscriptions.push(vscode.languages.registerCompletionItemProvider(
    'solidity', new GoCompletionItemProvider(), '.', '\"'));

}

