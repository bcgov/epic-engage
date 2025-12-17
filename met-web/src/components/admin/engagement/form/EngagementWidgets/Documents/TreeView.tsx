import * as React from 'react';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { If, Then, Else } from 'react-if';
import { DocumentItem, DOCUMENT_TYPE } from 'models/document';
import { StyledTreeItem } from './StyledTreeItem';
import { TreeItemProps } from '@mui/x-tree-view/TreeItem';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

type DocumentTreeProps = TreeItemProps & {
    documentItem: DocumentItem;
};

export default function DocumentTree({ documentItem }: DocumentTreeProps) {
    return (
        <SimpleTreeView
            aria-label="documentTree"
            defaultExpandedItems={['3']}
            slots={{
                collapseIcon: () => <ArrowDropDownIcon sx={{ height: '35px', width: '35px' }} />,
                expandIcon: () => <ArrowRightIcon sx={{ height: '35px', width: '35px' }} />,
                endIcon: () => <div style={{ width: 24 }} />,
            }}
            sx={{ flexGrow: 1, maxWidth: 1000, overflowY: 'auto' }}
        >
            <If condition={documentItem.type === 'folder'}>
                <Then>
                    <StyledTreeItem
                        labelUrl={documentItem.url}
                        itemId={`${documentItem.id}`}
                        labelText={documentItem.title}
                        labelIcon={FolderOutlinedIcon}
                    >
                        {documentItem.children?.map((document: DocumentItem) => {
                            return (
                                <StyledTreeItem
                                    key={document.id}
                                    itemId={`${document.id}`}
                                    innerDocument
                                    labelText={document.title}
                                    labelIcon={
                                        document.type === DOCUMENT_TYPE.FOLDER
                                            ? FolderOutlinedIcon
                                            : DescriptionOutlinedIcon
                                    }
                                    labelUrl={document.url}
                                />
                            );
                        })}
                    </StyledTreeItem>
                </Then>
                <Else>
                    <StyledTreeItem
                        itemId={`${documentItem.id}`}
                        labelText={documentItem.title}
                        labelIcon={DescriptionOutlinedIcon}
                        labelUrl={documentItem.url}
                    />
                </Else>
            </If>
        </SimpleTreeView>
    );
}
