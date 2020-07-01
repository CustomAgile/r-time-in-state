Ext.define("TSTimeInState", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    integrationHeaders: {
        name: "TSTimeInState"
    },
    defaults: { margin: 5 },
    layout: {
        type: 'vbox',
        align: 'stretch'
    },
    items: [
        {
            xtype: 'container',
            minHeight: 20,
            width: '100%',
            items: [{
                xtype: 'tabpanel',
                itemId: 'filterAndSettingsPanel',
                // stateful: true,
                // stateId: 'time-in-state-filter-and-settings-panel',
                header: false,
                collapsible: true,
                animCollapse: false,
                cls: 'blue-tabs',
                activeTab: 0,
                plain: true,
                tabBar: {
                    margin: '0 0 0 100'
                },
                autoRender: true,
                minTabWidth: 140,
                width: '100%',
                items: [
                    {
                        title: 'FILTERS',
                        html: '',
                        itemId: 'filtersTab',
                        padding: 5,
                        width: '100%',
                        items: [
                            {
                                id: Utils.AncestorPiAppFilter.RENDER_AREA_ID,
                                xtype: 'container',
                                layout: {
                                    type: 'hbox',
                                    align: 'middle',
                                    defaultMargins: '0 10 10 0',
                                },
                                width: '100%'
                            }, {
                                id: Utils.AncestorPiAppFilter.PANEL_RENDER_AREA_ID,
                                xtype: 'container',
                                layout: {
                                    type: 'hbox',
                                    align: 'middle',
                                    defaultMargins: '0 10 10 0',
                                },
                                width: '100%'
                            },
                        ]
                    },
                    {
                        title: 'Report Settings',
                        html: '',
                        itemId: 'settingsTab',
                        padding: 5,
                        defaultMargins: '5 10 0 0',
                        items: [{
                            xtype: 'container',
                            itemId: 'selector_box',
                            layout: 'hbox',
                            defaults: { margin: 10, layout: 'vbox' }
                        }]
                    },
                    {
                        title: 'Projects',
                        itemId: 'projectsTab',
                        padding: 10,
                    }
                ]
            }]
        },
        {
            xtype: 'container',
            itemId: 'button_bar',
            layout: {
                type: 'hbox',
                align: 'stretch',
                pack: 'end',
                defaultMargins: 2,
            },
            height: 28
        },
        {
            xtype: 'container',
            itemId: 'display_box',
            layout: {
                type: 'vbox',
                align: 'stretch',
                defaultMargins: 5,
            },
            flex: 1
        }
    ],

    launch: async function () {
        Rally.data.wsapi.Proxy.superclass.timeout = 180000;
        Rally.data.wsapi.batch.Proxy.superclass.timeout = 180000;
        this.settingsWidth = 220;
        this.labelWidth = 60;
        this.setLoading();
        this.addProjectPicker();
        this._setDisplayFormats();
        this.addCollapseBtn();

        if (this.getWidth() < 1024) {
            this.down('#selector_box').add([
                {
                    xtype: 'container',
                    layout: 'vbox',
                    items: [
                        { xtype: 'container', itemId: 'artifact_box' },
                        { xtype: 'container', itemId: 'state_selector_box' }
                    ]
                },
                {
                    xtype: 'container',
                    layout: 'vbox',
                    items: [
                        { xtype: 'container', itemId: 'date_selector_box' },
                        { xtype: 'container', itemId: 'metric_box', layout: 'column', align: 'center', width: 110 }
                    ]
                }
            ]);
        }
        else {
            this.down('#selector_box').add([
                { xtype: 'container', itemId: 'artifact_box' },
                { xtype: 'container', itemId: 'state_selector_box' },
                { xtype: 'container', itemId: 'date_selector_box' },
                { xtype: 'container', itemId: 'metric_box', layout: 'column', align: 'center', width: 110 }
            ]);
        }

        this.down('#display_box').on('resize', this.onGridAreaResize, this);

        // Hide floating components because of course they are still visible when settings menu is shown
        this.on('beforehide', () => {
            this.collapseBtn.hide();
        });
        this.on('beforeshow', () => {
            this.collapseBtn.show();

            if (this.down('#filterAndSettingsPanel').getActiveTab().title.indexOf('FILTERS') === -1) {
                setTimeout(() => this.ancestorFilterPlugin.hideHelpButton(), 1000);
            }
        });

        var filters = Rally.data.wsapi.Filter.or([
            { property: 'TypePath', operator: 'contains', value: 'PortfolioItem/' },
            { property: 'Name', value: 'Defect' },
            { property: 'Name', value: 'Hierarchical Requirement' }
        ]);

        this.down('#artifact_box').add({
            xtype: 'tsrecordtypecombobox',
            fieldLabel: 'Type',
            typeFilter: filters,
            margin: '0 5 10 0',
            width: this.settingsWidth,
            labelWidth: this.labelWidth,
            listeners: {
                scope: this,
                change: function (cb) {
                    if (this.process && this.process.getState().toLowerCase() === 'pending') {
                        this.process.cancel();
                    }

                    this.process = Deft.Chain.sequence([
                        function () { return this._getModel(cb.getValue()); }
                    ], this).then({
                        scope: this,
                        success: function (results) {
                            this.model = results[0];
                            this.model_name = cb.getValue();

                            this._addSelectors();
                        },
                        failure: function (msg) {
                            this.setLoading(false);
                            Ext.Msg.alert('', msg);
                        }
                    });
                }
            }
        });
        this._addMultiLevelFilters();
        this.setLoading(false);
    },

    onGridAreaResize() {
        let gridArea = this.down('#display_box');
        let grid = this.down('rallygrid');

        if (gridArea && grid) {
            grid.setHeight(gridArea.getHeight());
        }
    },

    addProjectPicker() {
        let tab = this.down('#filterAndSettingsPanel').child('#projectsTab');
        this.down('#projectsTab').add({
            xtype: 'customagileprojectpicker',
            cmp: this,
            appName: 'time-in-state',
            tab,
            listeners: {
                scope: this,
                projectschanged: () => {
                    this.refreshProjects = true;
                    this._clearGrid();
                },
                applyprojects: () => {
                    this._updateData();
                }
            }
        });

        this.projectPicker = this.down('customagileprojectpicker');
    },

    addCollapseBtn() {
        this.collapseBtn = Ext.widget('rallybutton', {
            text: this.down('#filterAndSettingsPanel').getCollapsed() ? 'Expand Filters and Settings' : 'Collapse',
            floating: true,
            shadow: false,
            height: 21,
            handler: (btn) => {
                this.down('#filterAndSettingsPanel').toggleCollapse();
                if (btn.getText() === 'Collapse') {
                    btn.setText('Expand Filters and Settings');
                    this.ancestorFilterPlugin.hideHelpButton();
                }
                else {
                    btn.setText('Collapse');
                    if (this.down('#filterAndSettingsPanel').getActiveTab().title.indexOf('FILTERS') > -1) {
                        this.ancestorFilterPlugin.showHelpButton();
                    }
                }
            }
        });

        this.collapseBtn.showBy(this.down('#filterAndSettingsPanel'), 'tl-tl', [0, 3]);
    },

    _addMultiLevelFilters: function () {
        this.ancestorFilterPlugin = Ext.create('Utils.AncestorPiAppFilter', {
            ptype: 'UtilsAncestorPiAppFilter',
            pluginId: 'ancestorFilterPlugin',
            settingsConfig: {},
            overrideGlobalWhitelist: true,
            whiteListFields: ['Tags', 'Milestones', 'c_EnterpriseApprovalEA', 'c_EAEpic', 'DisplayColor'],
            filtersHidden: false,
            displayMultiLevelFilter: true,
            visibleTab: this.model_name,
            listeners: {
                scope: this,
                ready(plugin) {
                    plugin.addListener({
                        scope: this,
                        select: this.filtersChange,
                        change: this.filtersChange
                    });
                    this.down('#filterAndSettingsPanel').on('beforetabchange', (tabs, newTab) => {
                        if (newTab.title.indexOf('FILTERS') > -1) {
                            this.ancestorFilterPlugin.showHelpButton();
                        }
                        else {
                            this.ancestorFilterPlugin.hideHelpButton();
                        }
                    });
                    this.down('#filterAndSettingsPanel').setActiveTab(1);
                    setTimeout(() => {
                        this.updateFilterTabText();
                        this.projectPicker.updateProjectTabText;
                    }, 600);
                },
                failure(msg) {
                    this.setLoading(false);
                    this.showError(msg, 'Failed to load multi-level filters');
                }
            }
        });
        this.addPlugin(this.ancestorFilterPlugin);
    },

    filtersChange() {
        this._clearGrid();
        this.updateFilterTabText();
    },

    updateFilterTabText(filters) {
        if (!filters) {
            filters = this.ancestorFilterPlugin.getMultiLevelFilters();
        }
        let totalFilters = 0;
        _.each(filters, function (filter) {
            totalFilters += filter.length;
        });

        let titleText = totalFilters ? `FILTERS (${totalFilters})` : 'FILTERS';
        let tab = this.down('#filterAndSettingsPanel').child('#filtersTab');

        if (tab) { tab.setTitle(titleText); }
    },

    async loadProjects() {
        this.setLoading('Loading Projects...');

        if (this.useSpecificProjects()) {
            await this._getSpecificProjectList();
        }
        else {
            await this._getScopedProjectList();
        }
    },

    async _getScopedProjectList() {
        let projectStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'Project',
            fetch: ['Name', 'ObjectID', 'Children', 'Parent'],
            filters: [{ property: 'ObjectID', value: this.getContext().getProject().ObjectID }],
            limit: 1,
            pageSize: 1,
            autoLoad: false
        });

        let results = await projectStore.load();
        let parents = [];
        let children = [];
        if (results && results.length) {
            if (this.getContext().getProjectScopeDown()) {
                children = await this._getAllChildProjects(results);
            }

            if (this.getContext().getProjectScopeUp()) {
                parents = await this._getAllParentProjects(results[0]);
            }

            if (children.length) {
                results = children.concat(parents);
            }
            else if (parents.length) {
                results = parents;
            }

            this.projects = results;

            this.projectRefs = _.map(results, (p) => {
                return p.get('_ref');
            });
        }
        else {
            this.projects = [];
            this.projectRefs = [];
        }
    },

    async _getSpecificProjectList() {
        let projects = this.projectPicker.getValue();

        if (this.projectPicker.includeChildProjects()) {
            projects = await this._getAllChildProjects(projects);
        }

        this.projects = projects;

        this.projectRefs = _.map(projects, (p) => {
            return p.get('_ref');
        });
    },

    async _getAllChildProjects(allRoots = [], fetch = ['Name', 'Children', 'ObjectID']) {
        if (!allRoots.length) { return []; }

        const promises = allRoots.map(r => this.wrap(r.getCollection('Children', { fetch, limit: Infinity, filters: [{ property: 'State', value: 'Open' }] }).load()));
        const children = _.flatten(await Promise.all(promises));
        const decendents = await this._getAllChildProjects(children, fetch);
        const removeDupes = {};
        let finalResponse = _.flatten([...decendents, ...allRoots, ...children]);

        // eslint-disable-next-line no-return-assign
        finalResponse.forEach(s => removeDupes[s.get('_ref')] = s);
        finalResponse = Object.values(removeDupes);
        return finalResponse;
    },

    async _getAllParentProjects(p) {
        let projectStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'Project',
            fetch: ['Name', 'ObjectID', 'Parent'],
            filters: [{ property: 'ObjectID', value: p.get('Parent').ObjectID }],
            limit: 1,
            pageSize: 1,
            autoLoad: false
        });

        let results = await projectStore.load();
        if (results && results.length) {
            if (results[0].get('Parent')) {
                let parents = await this._getAllParentProjects(results[0]);
                return [p].concat(parents);
            }
            return [p, results[0]];
        }
        return [p];
    },

    async wrap(deferred) {
        if (!deferred || !_.isFunction(deferred.then)) {
            return Promise.reject(new Error('Wrap cannot process this type of data into a ECMA promise'));
        }
        return new Promise((resolve, reject) => {
            deferred.then({
                success(...args) {
                    resolve(...args);
                },
                failure(error) {
                    reject(error);
                },
                scope: this
            });
        });
    },

    _setDisplayFormats: function () {
        var user_context = this.getContext().getUser();

        this.dateFormat = user_context.UserProfile.DateFormat;
        this.timeFormat = user_context.UserProfile.DateTimeFormat;

        if (Ext.isEmpty(this.dateFormat)) {
            this.dateFormat = this.getContext().getWorkspace().WorkspaceConfiguration.DateFormat;
        }

        if (Ext.isEmpty(this.timeFormat)) {
            this.timeFormat = this.getContext().getWorkspace().WorkspaceConfiguration.DateTimeFormat;
        }

        this.timeFormat = this.timeFormat.replace(/z/, '');

        return;
    },

    _clearBoxes: function (containers) {
        Ext.Array.each(containers, function (container) {
            container.removeAll();
        });
    },

    _addSelectors: function () {
        var field_chooser_box = this.down('#artifact_box');
        var state_chooser_box = this.down('#state_selector_box');
        var date_chooser_box = this.down('#date_selector_box');
        var button_bar = this.down('#button_bar');
        var metric_box = this.down('#metric_box');
        var context = this.getContext();

        this._clearBoxes([state_chooser_box, metric_box,
            date_chooser_box, button_bar]);

        if (this.down('rallyfieldcombobox')) {
            this.down('rallyfieldcombobox').destroy();
        }

        field_chooser_box.add({
            xtype: 'rallyfieldcombobox',
            model: this.model,
            _isNotHidden: this._isNotHidden,
            fieldLabel: 'State Field',
            width: this.settingsWidth,
            margin: '0 5 10 0',
            labelWidth: this.labelWidth,
            stateful: true,
            stateId: this.getModelScopedStateId(this.model.typePath, 'techservices-timeinstate-fieldcombo'),
            stateEvents: ['change'],
            listeners: {
                scope: this,
                change: function (cb) {
                    this._addStateSelectors(state_chooser_box, cb.getValue());
                }
            }
        });

        this._addDateSelectors(date_chooser_box);

        metric_box.add({
            xtype: 'rallycombobox',
            itemId: 'columnDetailCombo',
            fieldLabel: 'Columns',
            width: this.settingsWidth,
            labelSeparator: '',
            labelWidth: this.labelWidth,
            stateful: true,
            stateId: this.getModelScopedStateId(this.model.typePath, 'techservices-timeinstate-column-detail-combo'),
            stateEvents: ['change'],
            displayField: 'name',
            valueField: 'value',
            editable: false,
            allowBlank: false,
            store: Ext.create('Ext.data.Store', {
                fields: ['name', 'value'],
                data: [
                    { name: 'Time In State', value: 'timeOnly' },
                    { name: 'Time In State And Enter/Exit Dates', value: 'timeAndDates' }
                ]
            }),
            listeners: {
                scope: this,
                change: function () {
                    this._clearGrid();
                }
            }
        });

        metric_box.add({
            xtype: 'rallycombobox',
            itemId: 'metricCombo',
            fieldLabel: 'Format',
            width: this.settingsWidth,
            labelSeparator: '',
            labelWidth: this.labelWidth,
            stateful: true,
            stateId: this.getModelScopedStateId(this.model.typePath, 'techservices-timeinstate-metric-combo'),
            stateEvents: ['change'],
            displayField: 'name',
            valueField: 'value',
            editable: false,
            allowBlank: false,
            store: Ext.create('Ext.data.Store', {
                fields: ['name', 'value'],
                data: [
                    { name: 'Days', value: 'Days' },
                    { name: 'Weeks', value: 'Weeks' },
                ]
            }),
            listeners: {
                scope: this,
                change: function (cb, newVal) {
                    if (newVal === 'Days' && this.down('#excludeWeekendsCheckbox')) {
                        this.down('#excludeWeekendsCheckbox').show();
                    }
                    else if (newVal === 'Weeks' && this.down('#excludeWeekendsCheckbox')) {
                        this.down('#excludeWeekendsCheckbox').hide();
                    }
                    this._clearGrid();
                }
            }
        });

        metric_box.add({
            xtype: 'rallycheckboxfield',
            fieldLabel: 'Exclude Weekends',
            labelSeparator: '',
            itemId: 'excludeWeekendsCheckbox',
            width: this.settingsWidth,
            labelWidth: this.settingsWidth - 20,
            margin: '3 0 0 0',
            stateful: true,
            // hidden: this.down('#metricCombo').getValue() !== 'Days',
            stateId: this.getModelScopedStateId(this.model.typePath, 'techservices-timeinstate-exclude-weekends-checkbox'),
            stateEvents: ['change']
        });

        button_bar.add({
            xtype: 'tsfieldpickerbutton',
            context,
            modelNames: [this.model.typePath],
            cls: 'secondary rly-small',
            margin: '0 30 0 0',
            height: 26,
            toolTipConfig: {
                html: 'Additional Columns',
                anchor: 'top'
            },
            alwaysSelectedValues: [],
            stateful: true,
            stateId: this.getModelScopedStateId(this.model.typePath, 'techservices-timeinstate-fieldpickerbutton'),
            listeners: {
                fieldsupdated: function () {
                    this._clearGrid();
                },
                scope: this
            }
        });

        button_bar.add({
            xtype: 'rallybutton',
            itemId: 'updateBtn',
            text: 'Update',
            cls: 'primary rly-small',
            height: 26,
            padding: 3,
            margin: '0 30 0 0',
            listeners: {
                scope: this,
                click: this._updateData
            }
        });

        button_bar.add({
            xtype: 'rallybutton',
            itemId: 'export_button',
            cls: 'secondary rly-small',
            text: '<span class="icon-export"> </span>',
            height: 26,
            margin: '0 30 0 0',
            disabled: true,
            listeners: {
                scope: this,
                click: function () {
                    this._export();
                }
            }
        });

        button_bar.add({
            xtype: 'rallybutton',
            cls: 'customagile-button help',
            iconOnly: true,
            iconCls: 'icon-help',
            handler: this._onHelpClicked,
            id: 'timeInStateHelp',
            margin: '0 0 0 5'
        });

        setTimeout(() => {
            if (this.down('#metricCombo') && this.down('#metricCombo').getValue() !== 'Days') {
                this.down('#excludeWeekendsCheckbox').hide();
            }
        }, 400);
    },

    _addStateSelectors: function (container, fieldName) {
        container.removeAll();
        this.stateFieldName = fieldName;

        container.add({
            xtype: 'rallyfieldvaluecombobox',
            model: this.model,
            itemId: 'start_state_selector',
            margin: '0 5 10 0',
            field: fieldName,
            fieldLabel: 'Start State',
            width: this.settingsWidth,
            labelWidth: this.labelWidth,
            stateful: true,
            stateEvents: ['change'],
            stateId: this.getModelScopedStateId(this.model.typePath, 'techservices-timeinstate-startstatecombo')
        });

        container.add({
            xtype: 'rallyfieldvaluecombobox',
            model: this.model,
            itemId: 'end_state_selector',
            field: fieldName,
            fieldLabel: 'End State',
            width: this.settingsWidth,
            labelWidth: this.labelWidth,
            stateful: true,
            stateEvents: ['change'],
            stateId: this.getModelScopedStateId(this.model.typePath, 'techservices-timeinstate-endstatecombo')
        });

        container.add({
            xtype: 'rallycheckboxfield',
            fieldLabel: 'Include Blocked Time For Each State',
            labelSeparator: '',
            itemId: 'includeBlockedTimeCheckbox',
            width: this.settingsWidth,
            labelWidth: this.settingsWidth - 20,
            margin: '3 0 0 0',
            stateful: true,
            stateId: this.getModelScopedStateId(this.model.typePath, 'techservices-timeinstate-include-blocked-time-checkbox'),
            stateEvents: ['change']
        });
    },

    _addDateSelectors: function (container) {
        container.removeAll();

        container.add({
            xtype: 'rallydatefield',
            itemId: 'start_date_selector',
            margin: '0 5 10 0',
            fieldLabel: 'Start Date',
            allowBlank: false,
            width: this.settingsWidth,
            labelWidth: this.labelWidth,
            labelSeparator: '',
            stateful: true,
            stateEvents: ['change'],
            stateId: this.getModelScopedStateId(this.model.typePath, 'techservices-timeinstate-startdatecombo')
        });

        container.add({
            xtype: 'rallydatefield',
            itemId: 'end_date_selector',
            fieldLabel: 'End Date',
            width: this.settingsWidth,
            labelWidth: this.labelWidth,
            labelSeparator: '',
            margin: '0 5 10 0',
            stateful: true,
            stateEvents: ['change'],
            stateId: this.getModelScopedStateId(this.model.typePath, 'techservices-timeinstate-enddatecombo')
        });
    },


    _isNotHidden: function (field) {
        if (field.hidden) {
            return false;
        }
        var attributeDefn = field.attributeDefinition;

        if (Ext.isEmpty(attributeDefn)) {
            return false;
        }

        if (field.name == "State") {
            return true;
        }

        if (attributeDefn.AttributeType == "STATE") {
            return true;
        }

        if (attributeDefn.AttributeType == "STRING" && attributeDefn.Constrained == true) {
            return true;
        }

        return false;
    },

    onTimeboxScopeChange: function () {
        this.callParent(arguments);
        this._clearGrid();
    },

    _clearGrid: function () {
        var container = this.down('#display_box');
        let exportBtn = this.down('#export_button');
        if (container && exportBtn) {
            exportBtn.setDisabled(true);
            container.removeAll();
        }
    },

    _updateData: async function () {
        this._clearGrid();
        var fieldName = this.stateFieldName;

        this.startState = this.down('#start_state_selector').getValue();
        this.endState = this.down('#end_state_selector').getValue();
        if (fieldName == "State" && /Portfolio/.test(this.model_name)) {
            this.startState = this.down('#start_state_selector').getRecord().get('name');
            this.endState = this.down('#end_state_selector').getRecord().get('name');
        }
        this.startDate = this.down('#start_date_selector').getValue();
        this.endDate = this.down('#end_date_selector').getValue();

        if (!this.startDate) {
            this.showError('Start date is required');
            return;
        }

        if (Ext.isEmpty(this.startState) || Ext.isEmpty(this.endState)) {
            this.showError('Start and End States are required');
            return;
        }

        try {
            this._setValidStates();
            let snapshots = await this._getChangeSnapshots(fieldName);
            let snaps_by_oid = this._organizeSnapshotsByOid(snapshots);
            let rows_by_oid = this._setTimeInStatesForAll(snaps_by_oid, fieldName);
            let rows = Ext.Object.getValues(rows_by_oid);
            rows = this._removeItemsOutsideTimeboxes(rows);
            rows = await this._syncWithCurrentData(rows);

            if (rows) {
                this._makeGrid(rows);
            }
            this.setLoading(false);
        }
        catch (e) {
            this.setLoading(false);
            this.showError(e);
        }
    },

    _syncWithCurrentData: async function (rows) {
        if (!rows.length) {
            return rows;
        }

        let fetch = ['ObjectID', 'FormattedID', 'Name', 'Project', 'Value'];
        fetch = fetch.concat(this.getAdditionalFieldsFromButton());

        let records = await this._getCurrentDataWithFilters(rows, fetch);

        if (!records) {
            throw new Error('Failed while loading records. Result set might be too large.');
        }

        rows = _.filter(rows, (r) => {
            for (let record of records) {
                if (record.get('ObjectID') === r.ObjectID) {
                    for (let f of fetch) {
                        if (f === 'Project') {
                            r.__ProjectName = record.get(f).Name;
                        }
                        else {
                            r[f] = CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(record, f, '; ', true);
                        }
                    }
                    return true;
                }
            }
            return false;
        });
        return rows;
    },

    _shouldFilterByTimebox: function () {
        let timeboxScope = this.getContext().getTimeboxScope();
        if (timeboxScope) {
            let type = timeboxScope.type;
            let model = this._getModelName().toLowerCase();
            if (type === 'iteration' && model.indexOf('portfolioitem') > -1) {
                return false;
            }
            else if (model.indexOf('portfolioitem') > -1 && model.indexOf('feature') === -1) {
                return false;
            }
            else {
                return true;
            }
        }
        return false;
    },

    _getCurrentDataWithFilters: async function (rows, fetch) {
        this.setLoading('Loading filters and column data');

        let context = this.getContext().getDataContext();
        let ids = _.map(rows, r => r.ObjectID);
        let filters = await this.ancestorFilterPlugin.getAllFiltersForType(this._getModelName(), true);

        if (this.searchAllProjects()) {
            context.project = null;
        } else if (this.useSpecificProjects() && this.projectRefs && this.projectRefs.length > 0) {
            context.project = null;
            filters.push(new Rally.data.wsapi.Filter({
                property: 'Project',
                operator: 'in',
                value: this.projectRefs
            }));
        }

        if (this._shouldFilterByTimebox()) {
            let timeboxScope = this.getContext().getTimeboxScope();
            if (timeboxScope) {
                filters.push(timeboxScope.getQueryFilter());
            }
        }

        filters.push(new Rally.data.wsapi.Filter({
            property: 'ObjectID',
            operator: 'in',
            value: ids
        }));

        var config = {
            model: this._getModelName(),
            filters,
            fetch,
            context,
            limit: 6000,
            enablePostGet: true
        };

        let records;
        try {
            records = await this._loadWsapiRecords(config);
        } catch (e) { };

        this.setLoading(false);

        return records;
    },

    _removeItemsOutsideTimeboxes: function (rows) {
        if (Ext.isEmpty(this.startDate) && Ext.isEmpty(this.endDate)) {
            return rows;
        }

        var states = this._getShowStates(this.allowedStates, this.startState, this.endState);
        var filtered_rows = this._getRowsAfter(rows, this.startDate, states);
        filtered_rows = this._getRowsBefore(filtered_rows, this.endDate, states);
        return filtered_rows;
    },

    _getRowsAfter: function (rows, start_date, states) {
        if (Ext.isEmpty(start_date)) {
            return rows;
        }

        // let enter_field = 'firstEntry_' + this.startState;
        let start = Rally.util.DateTime.toIsoString(start_date);

        return Ext.Array.filter(rows, function (row) {
            for (let state of states) {
                let enter_field = 'firstEntry_' + state;
                if (row[enter_field] && row[enter_field] >= start) {
                    return true;
                }
            }
            return false;
            // var enter = row[enter_field];
            // if (Ext.isEmpty(enter)) {
            //     return false;
            // }
            // return (Rally.util.DateTime.toIsoString(start_date) <= enter);
        });
    },

    _getRowsBefore: function (rows, end_date, states) {
        if (Ext.isEmpty(end_date)) {
            return rows;
        }

        // let enter_field = 'firstEntry_' + this.startState;
        let end = Rally.util.DateTime.toIsoString(end_date);

        return Ext.Array.filter(rows, function (row) {
            for (let state of states) {
                let enter_field = 'firstEntry_' + state;
                if (row[enter_field] && row[enter_field] <= end) {
                    return true;
                }
            }
            return false;
            // var enter = row[enter_field];
            // if (Ext.isEmpty(enter)) {
            //     return false;
            // }
            // return (Rally.util.DateTime.toIsoString(start_date) <= enter);
        });
        // var enter_field = 'firstEntry_' + this.startState;

        // return Ext.Array.filter(rows, function (row) {
        //     var enter = row[enter_field];
        //     if (Ext.isEmpty(enter)) {
        //         return false;
        //     }
        //     return (Rally.util.DateTime.toIsoString(end_date) >= enter);
        // });
    },

    _setTimeInStatesForAll: function (snaps_by_oid, fieldName) {
        var rows_by_oid = {};
        var me = this;
        var includeBlocked = this.includeBlocked();
        Ext.Object.each(snaps_by_oid, function (key, snaps) {
            rows_by_oid[key] = me._calculateTimeInState(snaps, fieldName, includeBlocked);
        });
        return rows_by_oid;
    },

    _calculateTimeInState: function (snapshots, fieldName, includeBlocked) {
        var entries = {};  // date of entry into state, used for calc
        var last_index = snapshots.length - 1;
        var excludeWeekends = this.down('#excludeWeekendsCheckbox').getValue();
        var format = this.down('#metricCombo').getValue();
        var row = Ext.Object.merge({
            snapshots: snapshots,
            __ProjectName: snapshots[last_index].get('__ProjectName'),
            __Project: snapshots[last_index].get('__Project')
        },
            snapshots[last_index].getData()
        );

        // Initialize data points for each state
        Ext.Array.each(this.allowedStates, function (state) {
            row[state] = 0;
            entries[state] = null;
            row['firstEntry_' + state] = null;
            row['lastExit_' + state] = null;

            if (includeBlocked) {
                row[state + '_blocked'] = 0;
                entries[state + '_blocked'] = null;
                row['firstEntry_' + state + '_blocked'] = null;
                row['lastExit_' + state + '_blocked'] = null;
            }
        }.bind(this));

        Ext.Array.each(snapshots, function (snap) {
            let fromState = snap.get('_PreviousValues.' + fieldName);
            let toState = snap.get(fieldName);
            let snapTime = snap.get('_ValidFrom');
            let isBlocked = snap.get('Blocked');
            let blockedChanged = typeof snap.get('Blocked') === 'boolean' && typeof snap.get('_PreviousValues.Blocked') === 'boolean';

            // For each snapshot, _PreviousValues will only contain fields that experienced a change at the exact time of the snapshot
            // This will tell us whether the snapshot was taken due to a state change or a Blocked change or both
            if (includeBlocked && blockedChanged) {
                if (isBlocked) {
                    // Note the time the artifact became blocked
                    entries[toState + '_blocked'] = snapTime;
                }
                else {
                    // If state was changed at the same time
                    if (fromState) {
                        if (entries[fromState + '_blocked']) {
                            // Add the duration of blocked time to the previous state
                            let delta = this._getTimeDelta(entries[fromState + '_blocked'], snapTime, excludeWeekends, format);
                            row[fromState + '_blocked'] += delta;
                            entries[fromState + '_blocked'] = null;
                        }
                    }
                    // Same state as before
                    else {
                        if (entries[toState + '_blocked']) {
                            // Add the duration of blocked time to the current state
                            let delta = this._getTimeDelta(entries[toState + '_blocked'], snapTime, excludeWeekends, format);
                            row[toState + '_blocked'] += delta;
                            entries[toState + '_blocked'] = null;
                        }
                    }
                }
            }

            if (fromState) {
                if (includeBlocked) {
                    // Case where artifact was already blocked and then entered a new state
                    if (isBlocked && !blockedChanged) {
                        entries[toState + '_blocked'] = snapTime;
                        if (entries[fromState + '_blocked']) {
                            let delta = this._getTimeDelta(entries[fromState + '_blocked'], snapTime, excludeWeekends, format);
                            row[fromState + '_blocked'] += delta;
                            entries[fromState + '_blocked'] = null;
                        }
                    }
                }

                entries[toState] = snapTime;
                row['lastExit_' + toState] = null; // clear out for re-entry

                if (Ext.isEmpty(row['firstEntry_' + toState])) {
                    row['firstEntry_' + toState] = snapTime;
                }

                if (!Ext.isEmpty(entries[fromState])) {
                    let delta = this._getTimeDelta(entries[fromState], snapTime, excludeWeekends, format);
                    row[fromState] += delta;
                    row['lastExit_' + fromState] = snapTime;
                }
            }
        }.bind(this));

        // Add time to the current state of each row
        Ext.Array.each(this.allowedStates, function (state) {
            if (row['firstEntry_' + state] && !row['lastExit_' + state] && entries[state]) {
                let delta = this._getTimeDelta(entries[state], Rally.util.DateTime.toIsoString(new Date()), excludeWeekends, format);
                row[state] = row[state] + delta;
            }
            else if (!row['firstEntry_' + state] && !row['lastExit_' + state]) {
                row[state] = '';
                if (includeBlocked) {
                    row[state + '_blocked'] = '';
                }
            }

            if (includeBlocked && entries[state + '_blocked']) {
                let delta = this._getTimeDelta(entries[state + '_blocked'], Rally.util.DateTime.toIsoString(new Date()), excludeWeekends, format);
                row[state + '_blocked'] = row[state + '_blocked'] + delta;
            }
        }.bind(this));

        return row;
    },

    _getTimeDelta: function (start, end, excludeWeekends, format) {
        if (excludeWeekends && format === 'Days') {
            let delta = moment().isoWeekdayCalc(start, end, [1, 2, 3, 4, 5]);
            if (delta) { delta--; }
            return delta * 1440;
        }
        else {
            var jsStart = Rally.util.DateTime.fromIsoString(start);
            var jsEnd = Rally.util.DateTime.fromIsoString(end);
            return Rally.util.DateTime.getDifference(jsEnd, jsStart, 'minute');
        }
    },

    _getModelName: function () {
        return this.model_name;
    },

    _setValidStates: function () {
        var store = this.down('rallyfieldvaluecombobox').getStore();
        var count = store.getTotalCount();

        var values = [];
        for (var i = 0; i < count; i++) {
            var value = store.getAt(i);

            if (!Ext.isEmpty(value.get('value'))) {
                values.push(value.get('name'));
            }
        }
        this.allowedStates = values;

        return values;
    },

    _organizeSnapshotsByOid: function (snapshots) {
        var snapshots_by_oid = {};

        Ext.Array.each(snapshots, function (snap) {
            var oid = snap.get('ObjectID');
            if (Ext.isEmpty(snapshots_by_oid[oid])) {
                snapshots_by_oid[oid] = [];
            }

            snapshots_by_oid[oid].push(snap);
        });

        return snapshots_by_oid;
    },

    _getChangeSnapshots: async function (fieldName) {
        var filters = Ext.create('Rally.data.lookback.QueryFilter', {
            property: '_TypeHierarchy',
            value: this._getModelName()
        });


        if (!this.searchAllProjects() && (!this.projects || this.refreshProjects)) {
            await this.loadProjects();
            this.refreshProjects = false;
        }
        filters = filters.and(Ext.create('Rally.data.lookback.QueryFilter', {
            property: 'Project',
            operator: 'in',
            value: _.map(this.projects, p => p.get('ObjectID'))
        }));

        let endFilter = Ext.create('Rally.data.lookback.QueryFilter', {
            property: '_ValidTo',
            operator: '>=',
            value: Rally.util.DateTime.toIsoString(this.startDate)
        });

        let change_filters = Ext.create('Rally.data.lookback.QueryFilter', {
            property: '_PreviousValues.' + fieldName,
            operator: 'exists',
            value: true
        });

        var fetch_base = ['ObjectID', 'FormattedID',
            'Project', '_TypeHierarchy', '_PreviousValues',
            fieldName, '_PreviousValues.' + fieldName, '_ValidFrom', '_ValidTo'];

        if (this.includeBlocked()) {
            fetch_base = fetch_base.concat(['Blocked', '_PreviousValues.Blocked']);
            let blocked_filters = Ext.create('Rally.data.lookback.QueryFilter', {
                property: '_PreviousValues.Blocked',
                operator: 'exists',
                value: true
            });

            change_filters = change_filters.or(blocked_filters);
        }

        endFilter = endFilter.and(change_filters);
        filters = filters.and(endFilter);

        var hydrate = ['_PreviousValues.' + fieldName, fieldName];

        var config = {
            filters,
            fetch: fetch_base,
            hydrate,
            limit: Infinity,
            enablePostGet: true,
            useHttpPost: true,
            compress: true,
            removeUnauthorizedSnapshots: true
        };

        this.setLoading('Loading Historical Snapshots...');

        return this.wrap(Ext.create('Rally.data.lookback.SnapshotStore', config).load());
    },

    includeBlocked: function () {
        return this.down('#includeBlockedTimeCheckbox').getValue();
    },

    _getModel: function (model_name) {
        var deferred = Ext.create('Deft.Deferred');
        Rally.data.ModelFactory.getModel({
            type: model_name,
            success: function (model) {
                deferred.resolve(model);
            },
            failure: function () {
                this.setLoading(false);
                deferred.reject('cannot load model');
            }
        });
        return deferred.promise;
    },

    getAdditionalFieldsFromButton: function () {
        var fieldPicker = this.down('tsfieldpickerbutton');
        var result = [];
        if (fieldPicker) {
            result = fieldPicker.getFields();
        }
        return result;
    },

    _loadWsapiRecords: function (config) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config, config)).load({
            callback: function (records, operation, successful) {
                if (successful) {
                    deferred.resolve(records);
                } else {
                    me.setLoading(false);
                    if (operation.error && operation.error.errors) {
                        deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                    }
                    else {
                        deferred.reject('Unkown error while fetching historical snapshots. Filtered result set might be too large.');
                    }
                }
            }
        });
        return deferred.promise;
    },

    _makeGrid: function (rows) {
        this.rows = rows;
        this.down('#export_button').setDisabled(false);

        var container = this.down('#display_box');
        var store = Ext.create('Rally.data.custom.Store', { data: rows });

        container.add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: this._getColumns(),
            showRowActionsColumn: false,
            height: container.getHeight()
        });
    },

    _getShowStates: function (allowed_states, start_state, end_state) {
        var start_index = Ext.Array.indexOf(allowed_states, start_state);
        var end_index = Ext.Array.indexOf(allowed_states, end_state);

        // swap if chosen out of order
        if (start_index > end_index) {
            var holder = start_index;
            start_index = end_index;
            end_index = holder;
        }

        return (
            Ext.Array.filter(allowed_states, function (state, idx) {
                return (idx >= start_index && idx <= end_index);
            })
        );
    },

    _getPickableColumns: function () {
        var blacklist = ['Attachments', 'Changesets', 'Collaborators', 'Connections', 'Discussion', 'Risks', 'UserStories', 'Children', 'Defects', 'Tasks', 'TestCases', 'RevisionHistory', 'c_SalesforceCase'];

        var filtered_fields = Ext.Array.filter(this.model.getFields(), function (field) {
            if (field.hidden) {
                return false;
            }

            if (_.contains(blacklist, field.name)) {
                return false;
            }

            if (field.name == "FormattedID" || field.name == "Name") {
                return false;
            }

            if (field.name == "Iteration" || field.name == "Release") {
                return true;
            }

            var attributeDefn = field.attributeDefinition;
            if (Ext.isEmpty(attributeDefn)) {
                return false;
            }

            return true;
        });

        var object_renderer = function (value, meta, record) {
            if (Ext.isEmpty(value)) { return ""; }
            if (Ext.isObject(value)) { return value.Name || value.DisplayName; }

            return value;
        }

        return Ext.Array.map(filtered_fields, function (field) {
            return {
                dataIndex: field.name,
                text: field.displayName,
                hidden: true,
                renderer: object_renderer
            };
        });
    },

    _getColumns: function () {
        var me = this;
        var includeBlocked = this.includeBlocked();
        var metric = me.down('#metricCombo').getValue();
        var showDateColumns = this.down('#columnDetailCombo').getValue() === 'timeAndDates';
        var columns = [
            { dataIndex: 'FormattedID', text: 'id', width: 75 },
            { dataIndex: 'Name', text: 'Name', width: 200 },
            { dataIndex: '__ProjectName', text: 'Project', width: 155 }
        ];

        columns = columns.concat(_.map(this.getAdditionalFieldsFromButton(), c => { return { dataIndex: c, text: c }; }));
        var show_states = this._getShowStates(this.allowedStates, this.startState, this.endState);

        var date_renderer = function (value, meta, record) {
            if (Ext.isEmpty(value)) { return ""; }

            if (Ext.isString(value)) {
                value = Rally.util.DateTime.fromIsoString(value);
            }

            var format = me.timeFormat;
            if (metric === 'Days' || metric === 'Weeks') {
                format = me.dateFormat;
            }
            return Rally.util.DateTime.format(value, format);
        };


        Ext.Array.each(show_states, function (state) {
            columns.push({
                dataIndex: state,
                text: Ext.String.format('{0} ({1})', state, metric),
                align: 'right',
                renderer: function (value) {
                    if (Ext.isEmpty(value)) { return ""; }
                    let minutes = metric === 'Weeks' ? 10080 : 1440;
                    return Ext.Number.toFixed(value / minutes, 1);
                }
            });

            if (showDateColumns) {
                columns.push({
                    dataIndex: 'firstEntry_' + state,
                    text: state + ' first entered',
                    align: 'right',
                    renderer: date_renderer
                });

                columns.push({
                    dataIndex: 'lastExit_' + state,
                    text: state + ' last exited',
                    align: 'right',
                    renderer: date_renderer
                });
            }

            if (includeBlocked) {
                columns.push({
                    dataIndex: state + '_blocked',
                    text: Ext.String.format('{0} {1} ({2})', state, 'Blocked', metric),
                    align: 'right',
                    renderer: function (value) {
                        if (Ext.isEmpty(value)) { return ""; }
                        let minutes = metric === 'Weeks' ? 10080 : 1440;
                        return Ext.Number.toFixed(value / minutes, 1);
                    }
                });
            }
        });

        return columns;
    },

    searchAllProjects() {
        return this.ancestorFilterPlugin && this.ancestorFilterPlugin.getIgnoreProjectScope();
    },

    useSpecificProjects() {
        return !!this.projectPicker.getValue().length;
    },

    _export: function () {
        var me = this;
        var grid = this.down('rallygrid');
        var rows = this.rows;

        if (!grid && !rows) { return; }

        var filename = 'time-in-state-report.csv';
        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function () { return Rally.technicalservices.FileUtilities.getCSVFromRows(this, grid, rows); }
        ]).then({
            scope: this,
            success: function (csv) {
                if (csv && csv.length > 0) {
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv, filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({ message: 'No data to export' });
                }

            }
        }).always(function () { me.setLoading(false); });
    },

    getModelScopedStateId(modelName, id) {
        return this.getContext().getScopedStateId(`${modelName}-${id}`);
    },

    getOptions: function () {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },

    _launchInfo: function () {
        if (this.about_dialog) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink', {});
    },

    isExternal: function () {
        return typeof (this.getAppId()) == 'undefined';
    },

    getSettingsFields: function () {
        return [{
            xtype: 'text',
            text: ''
        }];
    },

    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings) {
        this.launch();
    },

    showError(msg, defaultMessage) {
        if (typeof msg === 'object') {
            console.log(msg);
        }
        Rally.ui.notify.Notifier.showError({ message: this.parseError(msg, defaultMessage) });
    },

    parseError(e, defaultMessage) {
        defaultMessage = defaultMessage || 'An unknown error has occurred';

        if (typeof e === 'string' && e.length) {
            return e;
        }
        if (e.message && e.message.length) {
            return e.message;
        }
        if (e.exception && e.error && e.error.errors && e.error.errors.length) {
            if (e.error.errors[0].length) {
                return e.error.errors[0];
            } else {
                if (e.error && e.error.response && e.error.response.status) {
                    return `${defaultMessage} (Status ${e.error.response.status})`;
                }
            }
        }
        if (e.exceptions && e.exceptions.length && e.exceptions[0].error) {
            return e.exceptions[0].error.statusText;
        }
        return defaultMessage;
    },


    _onHelpClicked: function () {
        CustomAgile.ui.tutorial.TimeInStateTutorial.showWelcomeDialog(Rally.getApp());
    }
});
