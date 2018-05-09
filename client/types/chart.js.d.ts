// Type definitions for Chart.js 2.7
// Project: https://github.com/nnnick/Chart.js
// Definitions by: Alberto Nuti <https://github.com/anuti>
//                 Fabien Lavocat <https://github.com/FabienLavocat>
//                 KentarouTakeda <https://github.com/KentarouTakeda>
//                 Larry Bahr <https://github.com/larrybahr>
//                 Daniel Luz <https://github.com/mernen>
//                 Joseph Page <https://github.com/josefpaij>
//                 Dan Manastireanu <https://github.com/danmana>
//                 Guillaume Rodriguez <https://github.com/guillaume-ro-fr>
//                 Sergey Rubanov <https://github.com/chicoxyzzy>
//                 Simon Archer <https://github.com/archy-bold>
//                 Hristo Venev
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

export declare class Chart {
    constructor(
        context: string | CanvasRenderingContext2D | HTMLCanvasElement | ArrayLike<CanvasRenderingContext2D | HTMLCanvasElement>,
        options: Chart.ChartConfiguration
    );

    readonly config: Chart.ChartConfiguration;
    readonly data: Chart.ChartData;
    destroy(): void;
    update(duration?: any, lazy?: any): void;
    render(duration?: any, lazy?: any): void;
    stop(): void;
    resize(): void;
    clear(): void;
    toBase64(): string;
    generateLegend(): {};
    getElementAtEvent(e: any): {};
    getElementsAtEvent(e: any): Array<{}>;
    getDatasetAtEvent(e: any): Array<{}>;
    ctx: CanvasRenderingContext2D | null;
    canvas: HTMLCanvasElement | null;
    chartArea: ChartArea;
    static pluginService: PluginServiceStatic;

    static defaults: {
        global: Chart.ChartOptions & Chart.ChartFontOptions;
        [key: string]: any;
    };

    static controllers: {
        [key: string]: any;
    };

    // Tooltip Static Options
    static Tooltip: Chart.ChartTooltipsStaticConfiguration;
}

export declare class PluginServiceStatic {
    register(plugin: PluginServiceRegistrationOptions): void;
    unregister(plugin: PluginServiceRegistrationOptions): void;
}

export interface PluginServiceRegistrationOptions {
    beforeInit?(chartInstance: Chart): void;
    afterInit?(chartInstance: Chart): void;

    resize?(chartInstance: Chart, newChartSize: Size): void;

    beforeUpdate?(chartInstance: Chart): void;
    afterScaleUpdate?(chartInstance: Chart): void;
    beforeDatasetsUpdate?(chartInstance: Chart): void;
    afterDatasetsUpdate?(chartInstance: Chart): void;
    afterUpdate?(chartInstance: Chart): void;

    // This is called at the start of a render. It is only called once, even if the animation will run for a number of frames. Use beforeDraw or afterDraw
    // to do something on each animation frame
    beforeRender?(chartInstance: Chart): void;

    // Easing is for animation
    beforeDraw?(chartInstance: Chart, easing: string): void;
    afterDraw?(chartInstance: Chart, easing: string): void;
    // Before the datasets are drawn but after scales are drawn
    beforeDatasetsDraw?(chartInstance: Chart, easing: string): void;
    afterDatasetsDraw?(chartInstance: Chart, easing: string): void;

    // Called before drawing the `tooltip`. If any plugin returns `false`,
    // the tooltip drawing is cancelled until another `render` is triggered.
    beforeTooltipDraw?(chartInstance: Chart): void;
    // Called after drawing the `tooltip`. Note that this hook will not,
    // be called if the tooltip drawing has been previously cancelled.
    afterTooltipDraw?(chartInstance: Chart): void;

    destroy?(chartInstance: Chart): void;

    // Called when an event occurs on the chart
    beforeEvent?(chartInstance: Chart, event: Event): void;
    afterEvent?(chartInstance: Chart, event: Event): void;
}

export interface Size {
    height: number;
    width: number;
}

type ChartType = 'line' | 'bar' | 'radar' | 'doughnut' | 'polarArea' | 'bubble' | 'pie';

type TimeUnit = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

type ScaleType = 'category' | 'linear' | 'logarithmic' | 'time' | 'radialLinear';

type PointStyle = 'circle' | 'cross' | 'crossRot' | 'dash' | 'line' | 'rect' | 'rectRounded' | 'rectRot' | 'star' | 'triangle';

type PositionType = 'left' | 'right' | 'top' | 'bottom';

type TicksSource = "auto" | "data" | "labels";

export interface ChartArea {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface ChartLegendItem {
    text?: string;
    fillStyle?: string;
    hidden?: boolean;
    lineCap?: string;
    lineDash?: number[];
    lineDashOffset?: number;
    lineJoin?: string;
    lineWidth?: number;
    strokeStyle?: string;
    pointStyle?: PointStyle;
}

export interface ChartLegendLabelItem extends ChartLegendItem {
    datasetIndex: number;
}

export interface ChartTooltipItem {
    xLabel?: string;
    yLabel?: string;
    datasetIndex?: number;
    index?: number;
}

export interface ChartTooltipLabelColor {
    borderColor: ChartColor;
    backgroundColor: ChartColor;
}

export interface ChartTooltipCallback {
    beforeTitle?(item: ChartTooltipItem[], data: ChartData): string | string[];
    title?(item: ChartTooltipItem[], data: ChartData): string | string[];
    afterTitle?(item: ChartTooltipItem[], data: ChartData): string | string[];
    beforeBody?(item: ChartTooltipItem[], data: ChartData): string | string[];
    beforeLabel?(tooltipItem: ChartTooltipItem, data: ChartData): string | string[];
    label?(tooltipItem: ChartTooltipItem, data: ChartData): string | string[];
    labelColor?(tooltipItem: ChartTooltipItem, chart: Chart): ChartTooltipLabelColor;
    labelTextColor?(tooltipItem: ChartTooltipItem, chart: Chart): string;
    afterLabel?(tooltipItem: ChartTooltipItem, data: ChartData): string | string[];
    afterBody?(item: ChartTooltipItem[], data: ChartData): string | string[];
    beforeFooter?(item: ChartTooltipItem[], data: ChartData): string | string[];
    footer?(item: ChartTooltipItem[], data: ChartData): string | string[];
    afterFooter?(item: ChartTooltipItem[], data: ChartData): string | string[];
}

export interface ChartAnimationParameter {
    chartInstance?: any;
    animationObject?: any;
}

export interface ChartPoint {
    x?: number | string | Date;
    y?: number | string | Date;
    r?: number;
}

export interface ChartConfiguration {
    type?: ChartType | string;
    data?: ChartData;
    options?: ChartOptions;
    // Plugins can require any options
    plugins?: any;
}

export interface ChartData {
    labels?: Array<string | string[]>;
    datasets?: ChartDataSets[];
}

export interface ChartOptions {
    responsive?: boolean;
    responsiveAnimationDuration?: number;
    aspectRatio?: number;
    maintainAspectRatio?: boolean;
    events?: string[];
    onHover?(this: Chart, event: MouseEvent, activeElements: Array<{}>): any;
    onClick?(event?: MouseEvent, activeElements?: Array<{}>): any;
    title?: ChartTitleOptions;
    legend?: ChartLegendOptions;
    tooltips?: ChartTooltipOptions;
    hover?: ChartHoverOptions;
    animation?: ChartAnimationOptions;
    elements?: ChartElementsOptions;
    layout?: ChartLayoutOptions;
    scales?: ChartScales;
    showLines?: boolean;
    spanGaps?: boolean;
    cutoutPercentage?: number;
    circumference?: number;
    rotation?: number;
    devicePixelRatio?: number;
    // Plugins can require any options
    plugins?: { [plugin: string]: any };
}

export interface ChartFontOptions {
    defaultFontColor?: ChartColor;
    defaultFontFamily?: string;
    defaultFontSize?: number;
    defaultFontStyle?: string;
}

export interface ChartTitleOptions {
    display?: boolean;
    position?: PositionType;
    fullWdith?: boolean;
    fontSize?: number;
    fontFamily?: string;
    fontColor?: ChartColor;
    fontStyle?: string;
    padding?: number;
    text?: string | string[];
}

export interface ChartLegendOptions {
    display?: boolean;
    position?: PositionType;
    fullWidth?: boolean;
    onClick?(event: MouseEvent, legendItem: ChartLegendLabelItem): void;
    onHover?(event: MouseEvent, legendItem: ChartLegendLabelItem): void;
    labels?: ChartLegendLabelOptions;
    reverse?: boolean;
}

export interface ChartLegendLabelOptions {
    boxWidth?: number;
    fontSize?: number;
    fontStyle?: string;
    fontColor?: ChartColor;
    fontFamily?: string;
    padding?: number;
    generateLabels?(chart: any): any;
    filter?(legendItem: ChartLegendLabelItem, data: ChartData): any;
    usePointStyle?: boolean;
}

export interface ChartTooltipOptions {
    enabled?: boolean;
    custom?(a: any): void;
    mode?: string;
    intersect?: boolean;
    backgroundColor?: ChartColor;
    titleFontFamily?: string;
    titleFontSize?: number;
    titleFontStyle?: string;
    titleFontColor?: ChartColor;
    titleSpacing?: number;
    titleMarginBottom?: number;
    bodyFontFamily?: string;
    bodyFontSize?: number;
    bodyFontStyle?: string;
    bodyFontColor?: ChartColor;
    bodySpacing?: number;
    footerFontFamily?: string;
    footerFontSize?: number;
    footerFontStyle?: string;
    footerFontColor?: ChartColor;
    footerSpacing?: number;
    footerMarginTop?: number;
    xPadding?: number;
    yPadding?: number;
    caretSize?: number;
    cornerRadius?: number;
    multiKeyBackground?: string;
    callbacks?: ChartTooltipCallback;
    filter?(item: ChartTooltipItem): boolean;
    itemSort?(itemA: ChartTooltipItem, itemB: ChartTooltipItem): number;
    position?: string;
    caretPadding?: number;
    displayColors?: boolean;
    borderColor?: ChartColor;
    borderWidth?: number;
}

export interface ChartTooltipsStaticConfiguration {
    positioners: {[mode: string]: ChartTooltipPositioner};
}

export type ChartTooltipPositioner = (elements: any[], eventPosition: Point) => Point;

export interface ChartHoverOptions {
    mode?: string;
    animationDuration?: number;
    intersect?: boolean;
    onHover?(this: Chart, event: MouseEvent, activeElements: Array<{}>): any;
}

export interface ChartAnimationObject {
    currentStep?: number;
    numSteps?: number;
    easing?: string;
    render?(arg: any): void;
    onAnimationProgress?(arg: any): void;
    onAnimationComplete?(arg: any): void;
}

export interface ChartAnimationOptions {
    duration?: number;
    easing?: string;
    onProgress?(chart: any): void;
    onComplete?(chart: any): void;
}

export interface ChartElementsOptions {
    point?: ChartPointOptions;
    line?: ChartLineOptions;
    arc?: ChartArcOptions;
    rectangle?: ChartRectangleOptions;
}

export interface ChartArcOptions {
    backgroundColor?: ChartColor;
    borderColor?: ChartColor;
    borderWidth?: number;
}

export interface ChartLineOptions {
    tension?: number;
    backgroundColor?: ChartColor;
    borderWidth?: number;
    borderColor?: ChartColor;
    borderCapStyle?: string;
    borderDash?: any[];
    borderDashOffset?: number;
    borderJoinStyle?: string;
    capBezierPoints?: boolean;
    fill?: 'zero' | 'top' | 'bottom' | boolean;
    stepped?: boolean;
}

export interface ChartPointOptions {
    radius?: number;
    pointStyle?: PointStyle;
    backgroundColor?: ChartColor;
    borderWidth?: number;
    borderColor?: ChartColor;
    hitRadius?: number;
    hoverRadius?: number;
    hoverBorderWidth?: number;
}

export interface ChartRectangleOptions {
    backgroundColor?: ChartColor;
    borderWidth?: number;
    borderColor?: ChartColor;
    borderSkipped?: string;
}

export interface ChartLayoutOptions {
  padding?: ChartLayoutPaddingObject | number;
}

export interface ChartLayoutPaddingObject {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface GridLineOptions {
    display?: boolean;
    color?: ChartColor;
    borderDash?: number[];
    borderDashOffset?: number;
    lineWidth?: number;
    drawBorder?: boolean;
    drawOnChartArea?: boolean;
    drawTicks?: boolean;
    tickMarkLength?: number;
    zeroLineWidth?: number;
    zeroLineColor?: ChartColor;
    zeroLineBorderDash?: number[];
    zeroLineBorderDashOffset?: number;
    offsetGridLines?: boolean;
}

export interface ScaleTitleOptions {
    display?: boolean;
    labelString?: string;
    fontColor?: ChartColor;
    fontFamily?: string;
    fontSize?: number;
    fontStyle?: string;
}

export interface CartesianTickOptions {
    autoSkip?: boolean;
    autoSkipPadding?: number;
    labelOffset?: number;
    maxRotation?: number;
    minRotation?: number;
    mirror?: boolean;
    padding?: number;
}

export interface AngleLineOptions {
    display?: boolean;
    color?: ChartColor;
    lineWidth?: number;
}

export interface PointLabelOptions {
    callback?(arg: any): any;
    fontColor?: ChartColor;
    fontFamily?: string;
    fontSize?: number;
    fontStyle?: string;
}

export interface CategoryOptions extends CartesianTickOptions {
    min?: string;
    max?: string;
    labels?: string[];
}

export interface LinearTickOptions extends CartesianTickOptions {
    beginAtZero?: boolean;
    min?: number;
    max?: number;
    maxTicksLimit?: number;
    stepSize?: number;
    suggestedMin?: number;
    suggestedMax?: number;
}

export interface LogarithmicTickOptions extends CartesianTickOptions {
    min?: number;
    max?: number;
}

type ChartColor = string | CanvasGradient | CanvasPattern | string[];

export interface ChartDataSets {
    cubicInterpolationMode?: 'default' | 'monotone';
    backgroundColor?: ChartColor | ChartColor[];
    borderWidth?: number | number[];
    borderColor?: ChartColor | ChartColor[];
    borderCapStyle?: string;
    borderDash?: number[];
    borderDashOffset?: number;
    borderJoinStyle?: string;
    borderSkipped?: PositionType;
    data?: number[] | ChartPoint[];
    fill?: boolean | number | string;
    hoverBackgroundColor?: string | string[];
    hoverBorderColor?: string | string[];
    hoverBorderWidth?: number | number[];
    label?: string;
    lineTension?: number;
    steppedLine?: 'before' | 'after' | boolean;
    pointBorderColor?: ChartColor | ChartColor[];
    pointBackgroundColor?: ChartColor | ChartColor[];
    pointBorderWidth?: number | number[];
    pointRadius?: number | number[];
    pointHoverRadius?: number | number[];
    pointHitRadius?: number | number[];
    pointHoverBackgroundColor?: ChartColor | ChartColor[];
    pointHoverBorderColor?: ChartColor | ChartColor[];
    pointHoverBorderWidth?: number | number[];
    pointStyle?: PointStyle | HTMLImageElement | Array<PointStyle | HTMLImageElement>;
    xAxisID?: string;
    yAxisID?: string;
    type?: string;
    hidden?: boolean;
    hideInLegendAndTooltip?: boolean;
    showLine?: boolean;
    stack?: string;
    spanGaps?: boolean;
}

export interface ChartScales {
    xAxes?: ChartXAxis[];
    yAxes?: ChartYAxis[];
}

export interface CommonAxis {
    type?: ScaleType | string;
    display?: boolean;
    id?: string;
    stacked?: boolean;
    ticks?: TickOptions;
    barThickness?: number;
    beforeUpdate?(scale?: any): void;
    beforeSetDimension?(scale?: any): void;
    beforeDataLimits?(scale?: any): void;
    beforeBuildTicks?(scale?: any): void;
    beforeTickToLabelConversion?(scale?: any): void;
    beforeCalculateTickRotation?(scale?: any): void;
    beforeFit?(scale?: any): void;
    afterUpdate?(scale?: any): void;
    afterSetDimension?(scale?: any): void;
    afterDataLimits?(scale?: any): void;
    afterBuildTicks?(scale?: any): void;
    afterTickToLabelConversion?(scale?: any): void;
    afterCalculateTickRotation?(scale?: any): void;
    afterFit?(scale?: any): void;
}

type ChartXAxis = BarXAxis | LinearAxis | LogarithmicAxis | TimeAxis;
type ChartYAxis = LinearAxis | LogarithmicAxis;

export interface BarXAxis extends CommonAxis {
    barPercentage?: number;
    barThickness?: number;
    categoryPercentage?: number;
    maxBarThickness?: number;
    gridLines?: GridLineOptions;
}

export interface CategoryAxis extends CommonAxis {
    type?: 'category';
    ticks?: CategoryTickOptions;
}

export interface LinearAxis extends CommonAxis {
    type?: 'linear';
    position?: string;
    offset?: boolean;
    gridLines?: GridLineOptions;
    scaleLabel?: ScaleTitleOptions;
    ticks?: LinearTickOptions;
}

export interface LogarithmicAxis extends CommonAxis {
    type?: 'logarithmic';
    ticks?: LogarithmicTickOptions;
}

export interface TimeAxis extends CommonAxis {
    type?: 'time' | string;
    time?: TimeScale;
    distribution?: string; // TODO
    bounds?: string; // TODO
}

export interface TimeDisplayFormat {
    millisecond?: string;
    second?: string;
    minute?: string;
    hour?: string;
    day?: string;
    week?: string;
    month?: string;
    quarter?: string;
    year?: string;
}

export interface TimeScale {
    displayFormats?: TimeDisplayFormat;
    isoWeekday?: boolean;
    max?: string;
    min?: string;
    parser?: string | ((arg: any) => any);
    round?: TimeUnit;
    tooltipFormat?: string;
    unit?: TimeUnit;
    unitStepSize?: number;
    stepSize?: number;
    minUnit?: TimeUnit;
}

export interface RadialLinearAxis {
    type: 'radialLinear' | string;
    angleLines?: AngleLineOptions;
    gridLines?: GridLineOptions;
    pointLabels?: PointLabelOptions;
    ticks?: RadialTickOptions;
}

export interface RadialTickOptions {
    backdropColor?: ChhartColor;
    backdropPaddingX?: number;
    backdropPaddingY?: number;
    beginsAtZero?: boolean;
    min?: number;
    max?: number;
    maxTicksLimit?: number;
    stepSize?: number;
    suggestedMax?: number;
    suggestedMin?: number;
    showLabelBackdrop?: boolean;
}

export interface Point {
    x: number;
    y: number;
}
