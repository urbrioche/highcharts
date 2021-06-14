/* *
 *
 *  Data Grid class
 *
 *  (c) 2012-2020 Torstein Honsi
 *
 *  License: www.highcharts.com/license
 *
 *  !!!!!!! SOURCE GETS TRANSPILED BY TYPESCRIPT. EDIT TS FILE ONLY. !!!!!!!
 *
 * */

/* *
 *
 *  Imports
 *
 * */

import type DataGridOptions from './DataGridOptions';
import DataTable from '../Data/DataTable.js';
import DataGridUtils from './DataGridUtils.js';
const {
    dataTableCellToString,
    emptyHTMLElement,
    makeDiv
} = DataGridUtils;
import H from '../Core/Globals.js';
const {
    doc
} = H;
import U from '../Core/Utilities.js';
const {
    merge
} = U;


/**
 * Internal types
 * @private
 */
declare global {
    namespace Highcharts {
        let DataGrid: DataGridClass;
    }
}
type DataGridClass = typeof DataGrid;


/* *
 *
 *  Class
 *
 * */

class DataGrid {

    /* *
     *
     *  Static Properties
     *
     * */

    private static defaultOptions: DataGridOptions = {
        // nothing here yet
    };

    public static cellHeight = 20; // TODO: Make dynamic, and add style options

    /* *
     *
     *  Properties
     *
     * */

    public container: HTMLElement;
    public options: DataGridOptions;
    public dataTable: DataTable;

    private rowElements: Array<HTMLElement>;
    private outerContainer: HTMLElement;
    private scrollContainer: HTMLElement;
    private innerContainer: HTMLElement;
    private headerContainer?: HTMLElement;
    private cellInputEl?: HTMLInputElement;
    private columnHeadersContainer?: HTMLElement;
    private columnDragHandlesContainer?: HTMLElement;
    private columnResizeCrosshair?: HTMLElement;
    private draggedResizeHandle: null|HTMLElement;
    private draggedColumnRightIx: null|number;
    private dragResizeStart?: number;


    /* *
     *
     *  Functions
     *
     * */

    constructor(container: (string|HTMLElement), options: DeepPartial<DataGridOptions>) {
        // Initialize containers
        if (typeof container === 'string') {
            const existingContainer = doc.getElementById(container);
            if (existingContainer) {
                this.container = existingContainer;
            } else {
                this.container = makeDiv('hc-dg-container', container);
            }
        } else {
            this.container = container;
        }
        this.outerContainer = makeDiv('hc-dg-outer-container');
        this.scrollContainer = makeDiv('hc-dg-scroll-container');
        this.innerContainer = makeDiv('hc-dg-inner-container');
        this.scrollContainer.appendChild(this.innerContainer);
        this.outerContainer.appendChild(this.scrollContainer);
        this.container.appendChild(this.outerContainer);

        // Init options
        this.options = merge(DataGrid.defaultOptions, options);

        // Init data table
        this.dataTable = this.initDataTable();

        this.rowElements = [];
        this.draggedResizeHandle = null;
        this.draggedColumnRightIx = null;
        this.render();
    }


    public getRowCount(): number {
        return this.dataTable.getRowCount();
    }


    // ---------------- Private methods


    /**
     * Get a reference to the underlying DataTable from options, or create one
     * if needed.
     * @return {DataTable}
     */
    private initDataTable(): DataTable {
        if (this.options.dataTable) {
            return this.options.dataTable;
        }
        if (this.options.json) {
            return DataTable.fromJSON(this.options.json);
        }
        return new DataTable();
    }


    /**
     * Render the data grid. To be called on first render, as well as when
     * options change, or the underlying data changes.
     */
    private render(): void {
        emptyHTMLElement(this.innerContainer);
        this.updateScrollingLength();
        this.applyContainerStyles();
        this.updateInnerContainerWidth();
        this.renderColumnHeaders();
        this.renderInitialRows();
        this.renderColumnDragHandles();
        this.addEvents();
    }


    /**
     * Apply CSS.
     */
    private applyContainerStyles(): void {
        // TODO: Use stylesheets.
        this.outerContainer.style.cssText =
            'width: 100%;' +
            'height: 100%;' +
            'overflow: scroll;' +
            'position: relative;';
        this.scrollContainer.style.cssText =
            'height: 1000px;' +
            'position: relative;' +
            'z-index: 1;';
        this.innerContainer.style.cssText =
            'display: flex;' +
            'flex-direction: column;' +
            'position: fixed;' +
            'overflow: hidden;' +
            'min-height: 20px;' +
            'z-index: -1;';
    }


    /**
     * Add internal event listeners to the grid.
     */
    private addEvents(): void {
        this.outerContainer.addEventListener('scroll', (e): void => this.onScroll(e));
        document.addEventListener('click', (e): void => this.onDocumentClick(e));
    }


    /**
     * Handle user scrolling the grid
     * @param {Event} e Event object
     */
    private onScroll(e: Event): void {
        e.preventDefault();
        window.requestAnimationFrame((): void => {
            const columnsInPresentationOrder = this.dataTable.getColumnNames();
            let i = Math.floor(this.outerContainer.scrollTop / DataGrid.cellHeight) || 0;

            for (const tableRow of this.rowElements) {
                const dataTableRow = this.dataTable.getRow(i, columnsInPresentationOrder);
                if (dataTableRow) {
                    const cellElements = tableRow.querySelectorAll('div');
                    dataTableRow.forEach((columnValue: DataTable.CellType, j: number): void => {
                        const cell = cellElements[j];
                        cell.textContent = dataTableCellToString(columnValue);
                    });
                }
                i++;
            }
        });
    }


    /**
     * Handle the user starting interaction with a cell.
     * @param {HTMLElement} cellEl The clicked cell.
     */
    private onCellClick(cellEl: HTMLElement): void {
        let input = cellEl.querySelector('input');
        const cellValue = cellEl.textContent;

        if (!input) {
            this.removeCellInputElement();

            // Replace cell contents with an input element
            cellEl.textContent = '';
            input = this.cellInputEl = document.createElement('input');
            input.style.width = '60px';
            cellEl.appendChild(input);
            input.focus();
            input.value = cellValue || '';
        }
    }


    /**
     * Handle the user clicking somewhere outside the grid.
     * @param {MouseEvent} e Event object.
     */
    private onDocumentClick(e: MouseEvent): void {
        if (this.cellInputEl && e.target) {
            const cellEl = this.cellInputEl.parentNode;
            const isClickInInput = cellEl && cellEl.contains(e.target as Node);
            if (!isClickInInput) {
                this.removeCellInputElement();
            }
        }
    }


    /**
     * Remove the <input> overlay and update the cell value
     */
    private removeCellInputElement(): void {
        const cellInputEl = this.cellInputEl;
        if (cellInputEl) {
            // TODO: This needs to modify DataTable. The change in DataTable
            // should cause a re-render?
            if (cellInputEl.parentNode) {
                cellInputEl.parentNode.textContent = cellInputEl.value;
            }
            cellInputEl.remove();
            delete this.cellInputEl;
        }
    }


    private updateInnerContainerWidth(): void {
        const newWidth = this.scrollContainer.offsetWidth;
        this.innerContainer.style.width = newWidth + 'px';
    }


    private updateScrollingLength(): void {
        const height = (this.getRowCount() + 1) * DataGrid.cellHeight;
        this.scrollContainer.style.height = height + 'px';
    }


    private getNumRowsToDraw(): number {
        return Math.min(
            this.getRowCount() + 1,
            Math.floor(this.outerContainer.clientHeight / DataGrid.cellHeight) - 1
        );
    }


    /**
     * Render a data cell.
     * @param {HTMLElement} parentRow The parent row to add the cell to.
     * @param {DataTable.CellType} cellValue The value to add in the data cell.
     */
    private renderCell(parentRow: HTMLElement, cellValue: DataTable.CellType): void {
        const cellEl = makeDiv('hc-dg-cell');
        cellEl.style.cssText = 'border: 1px solid black;' +
            'overflow: hidden;' +
            'padding: 0 10px;' +
            'z-index: -1;' +
            'flex: 1;';

        cellEl.textContent = dataTableCellToString(cellValue);

        cellEl.addEventListener('click', (): void => this.onCellClick(cellEl));
        parentRow.appendChild(cellEl);
    }


    /**
     * Render a row of data.
     * @param {DataTable.Row} row The row data to render. The data should be in presentation order.
     */
    private renderRow(row: DataTable.Row): void {
        const rowEl = makeDiv('hc-dg-row');
        rowEl.style.cssText = 'display: flex;' +
            'background-color: white;' +
            'max-height: 20px;' +
            'z-index: -1;' +
            'width: 100%;';

        row.forEach(this.renderCell.bind(this, rowEl));

        this.innerContainer.appendChild(rowEl);
        this.rowElements.push(rowEl);
    }


    /**
     * Render a column header for a column.
     * @param {HTMLElement} parentEl The parent element of the column header.
     * @param {string} columnName The name of the column.
     */
    private renderColumnHeader(parentEl: HTMLElement, columnName: string): void {
        const headerEl = makeDiv('hc-dg-column-header');
        headerEl.style.cssText = 'border: 1px solid black;' +
            'overflow: hidden;' +
            'padding: 0 10px;' +
            'flex: 1;';
        headerEl.textContent = columnName;
        parentEl.appendChild(headerEl);
    }


    /**
     * Render the column headers of the table
     */
    private renderColumnHeaders(): void {
        const columnNames = this.dataTable.getColumnNames();
        const columnHeadersContainer = this.columnHeadersContainer =
            this.columnHeadersContainer || makeDiv('hc-dg-column-headers');
        columnHeadersContainer.style.cssText = 'display: flex;' +
            'background-color: white;' +
            'max-height: 20px;' +
            'width: 100%;';

        emptyHTMLElement(columnHeadersContainer);

        columnNames.forEach(this.renderColumnHeader.bind(this, columnHeadersContainer));

        this.headerContainer = makeDiv('hc-dg-header-container');
        this.headerContainer.appendChild(columnHeadersContainer);
        this.innerContainer.appendChild(this.headerContainer);
    }


    /**
     * Render initial rows before the user starts scrolling
     */
    private renderInitialRows(): void {
        this.rowElements = [];
        const rowsToDraw = this.getNumRowsToDraw();
        const columnsInPresentationOrder = this.dataTable.getColumnNames();
        if (rowsToDraw > 0) {
            const rowData = this.dataTable.getRows(0, rowsToDraw, columnsInPresentationOrder);
            rowData.forEach(this.renderRow.bind(this));
        }
    }


    /**
     * Render the drag handles for resizing columns.
     */
    private renderColumnDragHandles(): void {
        if (!this.columnHeadersContainer) {
            return;
        }
        const container = this.columnDragHandlesContainer = this.columnDragHandlesContainer ||
            makeDiv('hc-dg-col-resize-container');
        const columnEls = this.columnHeadersContainer.children;
        const handleHeight = 20;

        emptyHTMLElement(container);

        for (let i = 1; i < columnEls.length; ++i) {
            const col = columnEls[i] as HTMLElement;
            const handle = makeDiv('hc-dg-col-resize-handle');
            handle.style.cssText = 'cursor: ew-resize;' +
                'opacity: 0;' +
                'background-color: rgba(255, 0, 0, 0.5);' +
                'position: absolute;' +
                'top: 0;' +
                'width: 6px';
            handle.style.height = handleHeight + 'px';
            handle.style.left = col.offsetLeft - 3 + 'px';
            handle.addEventListener('mouseover', (): void => {
                if (!this.draggedResizeHandle) {
                    handle.style.opacity = '1';
                }
            });
            handle.addEventListener('mouseleave', (): void => {
                if (!this.draggedResizeHandle) {
                    handle.style.opacity = '0';
                }
            });
            handle.addEventListener('mousedown', this.onHandleMouseDown.bind(this, handle, i));
            container.appendChild(handle);
        }

        this.renderColumnResizeCrosshair(container);

        document.addEventListener('mouseup', (e: MouseEvent): void => {
            if (this.draggedResizeHandle) {
                this.stopColumnResize(this.draggedResizeHandle, e);
            }
        });
        document.addEventListener('mousemove', (e: MouseEvent): void => {
            if (this.draggedResizeHandle) {
                this.updateColumnResizeDrag(e);
            }
        });
        if (this.headerContainer) {
            this.headerContainer.appendChild(container);
        }
    }


    /**
     * Render the crosshair shown when resizing columns.
     * @param {HTMLElement} container The container to place the crosshair in.
     */
    private renderColumnResizeCrosshair(container: HTMLElement): void {
        const el = this.columnResizeCrosshair = this.columnResizeCrosshair || makeDiv('hc-dg-col-resize-crosshair');
        const handleHeight = 20;

        el.style.cssText = 'position: absolute;' +
            'background-color: rgba(255, 0, 0, 0.5);' +
            'width: 4px;' +
            'left: 0;' +
            'opacity: 0;';

        el.style.top = handleHeight + 'px';
        el.style.height = this.innerContainer.offsetHeight - handleHeight + 'px';

        container.appendChild(el);
    }


    /**
     * On column resize handle click
     * @param {HTMLElement} handle The drag handle being clicked
     * @param {number} colRightIx The column ix to the right of the resize handle
     * @param {MouseEvent} e The mousedown event
     */
    private onHandleMouseDown(handle: HTMLElement, colRightIx: number, e: MouseEvent): void {
        if (this.draggedResizeHandle) {
            return;
        }
        e.preventDefault();
        this.draggedResizeHandle = handle;
        this.draggedColumnRightIx = colRightIx;
        this.dragResizeStart = e.pageX;

        const crosshair = this.columnResizeCrosshair;
        if (crosshair) {
            crosshair.style.left = handle.offsetLeft + handle.offsetWidth / 2 - crosshair.offsetWidth / 2 + 'px';
            crosshair.style.opacity = '1';
        }
    }


    /**
     * Update as we drag column resizer
     * @param {MouseEvent} e The mousemove event
     */
    private updateColumnResizeDrag(e: MouseEvent): void {
        const handle = this.draggedResizeHandle;
        const crosshair = this.columnResizeCrosshair;
        const colRightIx = this.draggedColumnRightIx;
        const colHeaders = this.columnHeadersContainer;
        if (!handle || !crosshair || colRightIx === null || !colHeaders || !this.dragResizeStart) {
            return;
        }

        const col = colHeaders.children[colRightIx] as HTMLElement;
        const diff = e.pageX - this.dragResizeStart;
        const newPos = col.offsetLeft + diff;
        handle.style.left = newPos - handle.offsetWidth / 2 + 'px';
        crosshair.style.left = newPos - crosshair.offsetWidth / 2 + 'px';
    }


    /**
     * Stop resizing a column
     * @param {HTMLElement} handle The handle being dragged
     * @param {MouseEvent} e The mouse up event
     */
    private stopColumnResize(handle: HTMLElement, e: MouseEvent): void {
        const crosshair = this.columnResizeCrosshair;
        const colRightIx = this.draggedColumnRightIx;
        const colContainer = this.columnHeadersContainer;
        if (!crosshair || !colContainer || !this.dragResizeStart || colRightIx === null) {
            return;
        }
        handle.style.opacity = '0';
        crosshair.style.opacity = '0';

        const colLeft = colContainer.children[colRightIx - 1] as HTMLElement;
        const colRight = colContainer.children[colRightIx] as HTMLElement;
        const diff = e.pageX - this.dragResizeStart;
        const newWidthLeft = colLeft.offsetWidth + diff;
        const newWidthRight = colRight.offsetWidth - diff;
        const diffRatioLeft = newWidthLeft / colLeft.offsetWidth;
        const diffRatioRight = newWidthRight / colRight.offsetWidth;
        const leftFlexRatio = colLeft.style.flex = (parseFloat(colLeft.style.flex) * diffRatioLeft).toFixed(3);
        const rightFlexRatio = colRight.style.flex = (parseFloat(colRight.style.flex) * diffRatioRight).toFixed(3);

        this.rowElements.forEach((row): void => {
            const cellElements = row.children;
            (cellElements[colRightIx - 1] as HTMLElement).style.flex = leftFlexRatio;
            (cellElements[colRightIx] as HTMLElement).style.flex = rightFlexRatio;
        });

        this.draggedResizeHandle = null;
        this.draggedColumnRightIx = null;

        this.renderColumnDragHandles();
    }
}

H.DataGrid = DataGrid;

export default DataGrid;