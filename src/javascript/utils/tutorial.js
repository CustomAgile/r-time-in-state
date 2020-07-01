Ext.define('CustomAgile.ui.tutorial.TimeInStateTutorial', {
    singleton: true,

    welcomeHtml: `
    <p>This app displays a grid of work items and the time each item spent in each "state".</p>
    <p>Additional fields can be added to the grid as columns and the data can be exported to a CSV file.</p>
    <p><b>Data caveats:</b></p>
    <ul>
        <li>Only changes to state or blockers between the start date and end date (today's date if end date is blank) 
            are retrieved. Any changes before this period will not be reflected in the report and may cause certain time 
            in state values to be off from expectations.</li>
        <li>If an artifact is moved in and out of the selected project scoping, those changes to the state or blockers 
            while outside of the scope will not be captured in the report.</li>
    </ul>
    `,

    defaultOffset: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
    ],

    defaultChevronOffset: [
        { x: 0, y: -14 },
        { x: 14, y: 0 },
        { x: 0, y: 14 },
        { x: -8, y: 0 }
    ],

    steps: [
        {
            target: 'tabbar tab',
            title: 'Filters and Settings',
            placement: 'bottom',
            offset: [
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 0, y: 14 },
                { x: 0, y: 0 }
            ],
            html: `
            <p>This series of tabs allows complete control over what data is aggregated and how it is displayed in the grid.</p>
            `,
            handler: () => {
                if (Rally.getApp().down('#filterAndSettingsPanel').getCollapsed()) {
                    Rally.getApp().collapseBtn.handler(Rally.getApp().collapseBtn);
                }
                Rally.getApp().down('#filterAndSettingsPanel').setActiveTab(0);
                Rally.getApp().ancestorFilterPlugin.showHelpButton();
            }
        },
        {
            target: '#' + Utils.AncestorPiAppFilter.PANEL_RENDER_AREA_ID,
            placement: 'bottom',
            title: 'Filters',
            html: `
            <p>This section provides fine-tuning of which work items display in the grid.</p>
            <p>Filters can be applied to stories and portfolio items. Scope can be set to the current project(s) or across the entire workspace via the "Owned by" dropdown
            (workspace scoping will result in longer load times or even timeouts). If any projects are selected via the project picker on the projects tab, it will override this scope selector.</p>
            <p>Additional filter help can be found by clicking on the help button in the top-right corner of the filters section.</p>
            `,
            handler: () => {
                Rally.getApp().down('#filterAndSettingsPanel').setActiveTab(0);
                Rally.getApp().ancestorFilterPlugin.showHelpButton();
            }
        },
        {
            target: '#settingsTab',
            placement: 'bottom',
            title: 'Report Settings',
            offset: [
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 0, y: 14 },
                { x: 0, y: 0 }
            ],
            html: `
            <p>This section provides options for controlling the work item type, state values and timeframe for the report.</p>
            <p><b>Type: </b>The work item type to show in the grid</p>
            <p><b>State Field: </b>Once a type is selected, the state field dropdown populates with possible fields that could be used to show the work items' transitions across states and the duration in each state.</p>
            <p><b>Start State / End State: </b>The range of states to include in the report. Any states before the start state and after the end state will not show in the report. If an item enters and 
            leaves the same state multiple times, the time in state is the sum of all time in that state.</p>
            <p><b>Include Blocked Time For Each State: </b>Selecting this checkbox will add a column for every state which provides the duration in which each artifact was blocked while in that state. The duration is 
            in the same time format as the time in state metric.</p>
            <p><b>Start Date / End Date: </b>The next 2 inputs specify the date range for the report. A start date is required. If an end date is not specified, the app defaults 
            to today. The app will only show items that have experienced at least one state transition within the specified date range.</p>
            <p><b>Columns: </b>For a cleaner looking grid (especially one that includes many states), selecting "Time In State" will only show a single column for each state, specifying the amount of time each work item was in 
            each state. Selecting "Time In State And Enter/Exit Dates" will also include columns specifying the dates at which the work items first entered and last exited each state.</p>
            <p><b>Format: </b>The time in state can be formatted as number of days or number of weeks spent in each state.</p>
            <p><b>Exclude Weekends: </b>If format is set to Days, an option is available to exclude weekends (Saturdays and Sundays) from the time in state calculations.</p>
            `,
            handler: () => {
                Rally.getApp().down('#filterAndSettingsPanel').setActiveTab(1);
                Rally.getApp().ancestorFilterPlugin.hideHelpButton();
            }
        },
        {
            target: '#projectsTab',
            placement: 'bottom',
            title: 'Projects',
            offset: [
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 0, y: 14 },
                { x: 0, y: 0 }
            ],
            html: `
            <p>This section is useful for fine-tuning the scope of projects that are included when loading user story data. If any projects are selected from this dropdown, they will be used instead of your current project scoping. This will also override the "Owned by any project" dropdown on the Filters tab.</p>
            <p>To include all projects below the selected projects, select the checkbox labeled "Show work from child projects".</p>
            `,
            handler: () => Rally.getApp().down('#filterAndSettingsPanel').setActiveTab(2)
        },
        {
            target: '#updateBtn',
            placement: 'bottom',
            title: 'Button Bar',
            chevronOffset: [
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 140, y: 14 },
                { x: 0, y: 0 }
            ],
            offset: [
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 0, y: 14 },
                { x: 0, y: 0 }
            ],
            html: `
            <p><b>Column Chooser: </b>Use this field picker to select additional columns to appear in the report. The additional columns will also be included in the export file.</p>
            <p><b>Update: </b>Once all of the necessary filters and settings have been selected, click this button to generate the report.</p>
            <p><b>Export: </b>Once the report has been generated, this button will create a CSV file including all of the data contained within the report.</p>
            `
        }
    ],

    showWelcomeDialog: function (app) {
        this.app = app;

        if (app.down('#filterAndSettingsPanel').getCollapsed()) {
            app.collapseBtn.handler(app.collapseBtn);
        }
        app.down('#filterAndSettingsPanel').setActiveTab(0);
        app.ancestorFilterPlugin.showHelpButton();

        this.welcomeDialog = Ext.create('Rally.ui.dialog.Dialog', {
            autoShow: true,
            layout: 'fit',
            componentCls: 'rly-popover dark-container',
            width: 500,
            height: 400,
            closable: true,
            autoDestroy: true,
            buttonAlign: 'center',
            autoScroll: true,
            title: 'Using the Time In State App',
            items: {
                xtype: 'component',
                html: this.welcomeHtml,
                padding: 10,
                style: 'font-size:12px;'
            },
            buttons: [
                {
                    xtype: "rallybutton",
                    text: 'Close',
                    cls: 'secondary rly-small',
                    listeners: {
                        click: () => {
                            this.welcomeDialog.close();
                        },
                        scope: this
                    }
                }, {
                    xtype: "rallybutton",
                    text: 'Next',
                    cls: 'primary rly-small',
                    listeners: {
                        click: function () {
                            this.showNextStep(0);
                            this.welcomeDialog.close();
                        },
                        scope: this
                    }
                }
            ]
        });
    },

    showNextStep: function (stepIndex) {
        if (this.popover) {
            Ext.destroy(this.popover);
        }

        if (stepIndex >= this.steps.length) {
            return;
        }

        if (stepIndex === -1) {
            this.showWelcomeDialog(this.app);
            return;
        }

        let currentStep = this.steps[stepIndex];

        if (currentStep.handler) {
            currentStep.handler();
        }

        let buttons = [{
            xtype: "rallybutton",
            text: 'Close',
            cls: 'secondary rly-small',
            listeners: {
                click: () => {
                    this.popover.close();
                },
                scope: this
            }
        }];

        buttons.push({
            xtype: "rallybutton",
            text: 'Previous',
            cls: 'primary rly-small',
            listeners: {
                click: function () {
                    this.showNextStep(stepIndex - 1);
                },
                scope: this
            }
        });

        if (stepIndex < this.steps.length - 1) {
            buttons.push({
                xtype: "rallybutton",
                text: 'Next',
                cls: 'primary rly-small',
                listeners: {
                    click: function () {
                        this.showNextStep(stepIndex + 1);
                    },
                    scope: this
                }
            });
        }

        this.popover = Ext.create('Rally.ui.popover.Popover', {
            target: this.app.down(currentStep.target).getEl(),
            placement: currentStep.placement || ['bottom', 'left', 'top', 'right'],
            chevronOffset: currentStep.chevronOffset || this.defaultChevronOffset,
            offsetFromTarget: currentStep.offset || this.defaultOffset,
            overflowY: 'auto',
            maxWidth: 700,
            maxHeight: 700,
            toFront: Ext.emptyFn,
            buttonAlign: 'center',
            title: currentStep.title,
            listeners: {
                destroy: function () {
                    this.popover = null;
                },
                scope: this
            },
            html: `<div class="tutorial-popover-body">${currentStep.html}</div>`,
            buttons
        });
    }

});