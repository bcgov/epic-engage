interface ModelElement {
    is(type: string): boolean;
    getAttribute(key: string): unknown;
}

interface ModelWriter {
    removeAttribute(key: string, item: ModelElement): void;
}

interface Editor {
    model: {
        document: {
            getRoot(): unknown;
            registerPostFixer(fixer: (writer: ModelWriter) => boolean): void;
        };
        createRangeIn(root: unknown): { getItems(): Iterable<ModelElement> };
    };
}

export function dropNegativeBlockIndent(editor: Editor) {
    editor.model.document.registerPostFixer((writer) => {
        let changed = false;
        const root = editor.model.document.getRoot();
        for (const item of editor.model.createRangeIn(root).getItems()) {
            const indent = item.is('element') && item.getAttribute('blockIndent');
            if (typeof indent === 'string' && indent.trim().startsWith('-')) {
                writer.removeAttribute('blockIndent', item);
                changed = true;
            }
        }
        return changed;
    });
}
