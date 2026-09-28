import { dropNegativeBlockIndent } from 'components/shared/form/FormBuilder/ckeditorPlugins';

const element = (blockIndent?: string) => {
    const attrs = new Map<string, string>();
    if (blockIndent !== undefined) attrs.set('blockIndent', blockIndent);
    return {
        is: (type: string) => type === 'element',
        getAttribute: (key: string) => attrs.get(key),
        attrs,
    };
};

const fakeEditor = (items: ReturnType<typeof element>[]) => {
    let postFixer: (writer: unknown) => boolean = () => false;
    const writer = {
        removeAttribute: (key: string, item: ReturnType<typeof element>) => item.attrs.delete(key),
    };
    const editor = {
        model: {
            document: {
                getRoot: () => ({}),
                registerPostFixer: (fn: typeof postFixer) => (postFixer = fn),
            },
            createRangeIn: () => ({ getItems: () => items }),
        },
    };
    return { editor, runPostFixer: () => postFixer(writer) };
};

const install = (editor: ReturnType<typeof fakeEditor>['editor']) =>
    new (dropNegativeBlockIndent as unknown as new (e: typeof editor) => unknown)(editor);

describe('dropNegativeBlockIndent', () => {
    it('removes a negative indent pasted from desktop Word', () => {
        const paragraph = element('-54.0pt');
        const { editor, runPostFixer } = fakeEditor([paragraph]);
        install(editor);

        expect(runPostFixer()).toBe(true);
        expect(paragraph.getAttribute('blockIndent')).toBeUndefined();
    });

    it('leaves positive and zero indents alone', () => {
        const indented = element('18.0pt');
        const zero = element('0cm');
        const plain = element();
        const { editor, runPostFixer } = fakeEditor([indented, zero, plain]);
        install(editor);

        expect(runPostFixer()).toBe(false);
        expect(indented.getAttribute('blockIndent')).toBe('18.0pt');
        expect(zero.getAttribute('blockIndent')).toBe('0cm');
    });
});
