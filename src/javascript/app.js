Ext.define("TSTimeInState", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    layout: 'border',

    items: [
        {
            xtype: 'container',
            layout: 'vbox',
            region: 'north',
            items: [
                {
                    id: Utils.AncestorPiAppFilter.RENDER_AREA_ID,
                    xtype: 'container',
                    width: '100%',
                    layout: {
                        type: 'hbox',
                        align: 'middle',
                        defaultMargins: '0 10 10 0',
                    }
                }, {
                    id: Utils.AncestorPiAppFilter.PANEL_RENDER_AREA_ID,
                    xtype: 'container',
                    width: '100%',
                    layout: {
                        type: 'hbox',
                        align: 'middle',
                        defaultMargins: '0 10 10 0',
                    }
                },
                {
                    xtype: 'container',
                    itemId: 'selector_box',
                    layout: 'hbox',
                    defaults: { margin: 10, layout: 'vbox' },
                    items: [
                        { xtype: 'container', itemId: 'artifact_box' },
                        { xtype: 'container', itemId: 'state_selector_box' },
                        { xtype: 'container', itemId: 'date_selector_box' },
                        { xtype: 'container', itemId: 'metric_box', layout: 'column', align: 'center', width: 110 },
                        { xtype: 'container', itemId: 'project_box' },
                        { xtype: 'container', flex: 1 },
                        { xtype: 'container', itemId: 'button_box', layout: 'hbox' }
                    ]
                }
            ]
        },
        { xtype: 'container', itemId: 'display_box', region: 'center', layout: 'fit' }
    ],

    integrationHeaders: {
        name: "TSTimeInState"
    },

    launch: async function () {
        Rally.data.wsapi.Proxy.superclass.timeout = 180000;
        Rally.data.wsapi.batch.Proxy.superclass.timeout = 180000;
        this.setLoading();

        this._setDisplayFormats();

        this.logger.log('formats:', this.dateFormat, this.timeFormat);

        var filters = Rally.data.wsapi.Filter.or([
            { property: 'TypePath', operator: 'contains', value: 'PortfolioItem/' },
            { property: 'Name', value: 'Defect' },
            { property: 'Name', value: 'Hierarchical Requirement' }
        ]);
        this.down('#artifact_box').add({
            xtype: 'tsrecordtypecombobox',
            fieldLabel: 'Type:',
            typeFilter: filters,

            labelWidth: 60,
            listeners: {
                scope: this,
                change: function (cb) {
                    if (this.process && this.process.getState() == "Pending") {
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

        this.projects = await this._getProjectList();
        this._addMultiLevelFilters();

        this.setLoading(false);
    },

    _addMultiLevelFilters: function () {
        this.ancestorFilterPlugin = Ext.create('Utils.AncestorPiAppFilter', {
            ptype: 'UtilsAncestorPiAppFilter',
            pluginId: 'ancestorFilterPlugin',
            settingsConfig: {},
            whiteListFields: [
                'Tags',
                'Milestones',
                'c_EnterpriseApprovalEA',
                'c_EAEpic',
                'DisplayColor'
            ],
            filtersHidden: false,
            visibleTab: this.model_name,
            listeners: {
                scope: this,
                ready(plugin) {
                    plugin.addListener({
                        scope: this,
                        select: this._clearGrid,
                        change: this._clearGrid
                    });

                    // this._filtersChange();
                },
                failure(msg) {
                    this.setLoading(false);
                    Rally.ui.notify.Notifier.showError({ message: msg });
                }
            }
        });
        this.addPlugin(this.ancestorFilterPlugin);
    },

    async _getProjectList() {
        let projectStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'Project',
            fetch: ['Name', 'ObjectID', 'Children'],
            filters: [{ property: 'ObjectID', value: this.getContext().getProject().ObjectID }],
            limit: 1,
            pageSize: 1,
            autoLoad: false
        });

        let results = await projectStore.load();
        if (results) {
            let projects = await this._getAllChildProjects(results);
            let projectIds = _.map(projects, (p) => {
                return p.get('ObjectID');
            });
            return projectIds;
        }
        else {
            return [];
        }
    },

    async _getAllChildProjects(allRoots = [], fetch = ['Name', 'Children', 'ObjectID']) {
        if (!allRoots.length) { return []; }

        const promises = allRoots.map(r => this._wrap(r.getCollection('Children', { fetch, limit: Infinity }).load()));
        const children = _.flatten(await Promise.all(promises));
        const decendents = await this._getAllChildProjects(children, fetch);
        const removeDupes = {};
        let finalResponse = _.flatten([...decendents, ...allRoots, ...children]);

        // eslint-disable-next-line no-return-assign
        finalResponse.forEach(s => removeDupes[s.get('_ref')] = s);
        finalResponse = Object.values(removeDupes);
        return finalResponse;
    },

    async _wrap(deferred) {
        if (!deferred || !_.isFunction(deferred.then)) {
            return Promise.reject(new Error('Wrap cannot process this type of data into a ECMA promise'));
        }
        return new Promise((resolve, reject) => {
            deferred.then({
                success(...args) {
                    resolve(...args);
                },
                failure(error) {
                    this.setLoading(false);
                    reject(error);
                }
            });
        });
    },

    _setDisplayFormats: function () {
        var user_context = this.getContext().getUser();
        this.logger.log("User Context", user_context);

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
        var button_box = this.down('#button_box');
        var metric_box = this.down('#metric_box');
        var project_box = this.down('#project_box');

        this._clearBoxes([state_chooser_box, metric_box, project_box,
            date_chooser_box, button_box]);

        if (this.down('rallyfieldcombobox')) {
            this.down('rallyfieldcombobox').destroy();
        }

        field_chooser_box.add({
            xtype: 'rallyfieldcombobox',
            model: this.model,
            _isNotHidden: this._isNotHidden,
            fieldLabel: 'State Field:',
            labelWidth: 60,
            stateful: true,
            stateId: 'techservices-timeinstate-fieldcombo',
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
            xtype: 'tsmultiprojectpicker',
            itemId: 'project_selector',
            workspace: this.getContext().getWorkspaceRef(),
            showProjectNames: false,
            margin: 0,
            stateful: true,
            stateEvents: ['change'],
            stateId: 'techservices-timeinstate-projectpickerbutton'
        });

        metric_box.add({
            xtype: 'tscolumnpickerbutton',
            cls: 'secondary big',
            columns: this._getPickableColumns(),
            margin: 0,
            toolTipText: 'Add Columns',
            stateful: true,
            stateId: 'techservices-timeinstate-fieldpickerbutton',
            stateEvents: ['columnsChosen']
        });

        metric_box.add({
            xtype: 'tstogglebutton',
            toggleState: 'Hours',
            itemId: 'metric_selector',
            margin: '3 0 0 0',
            stateful: true,
            stateId: 'techservices-timeinstate-metriccombo',
            stateEvents: ['change']
        });

        button_box.add({
            xtype: 'rallybutton',
            text: 'Update',
            padding: 3,
            margin: '10 0 0 5',
            listeners: {
                scope: this,
                click: this._updateData
            }
        });

        button_box.add({
            xtype: 'rallybutton',
            itemId: 'export_button',
            cls: 'secondary small',
            text: '<span class="icon-export"> </span>',
            height: 26,
            margin: '10 0 0 5',
            disabled: true,
            listeners: {
                scope: this,
                click: function () {
                    this._export();
                }
            }
        });
    },

    _addStateSelectors: function (container, field_name) {
        container.removeAll();
        this.state_field_name = field_name;
        var label_width = 60;

        container.add({
            xtype: 'rallyfieldvaluecombobox',
            model: this.model,
            itemId: 'start_state_selector',
            field: field_name,
            fieldLabel: 'Start State:',
            labelWidth: label_width,
            stateful: true,
            stateEvents: ['change'],
            stateId: 'techservices-timeinstate-startstatecombo'
        });

        container.add({
            xtype: 'rallyfieldvaluecombobox',
            model: this.model,
            itemId: 'end_state_selector',
            field: field_name,
            fieldLabel: 'End State:',
            labelWidth: label_width,
            stateful: true,
            stateEvents: ['change'],
            stateId: 'techservices-timeinstate-endstatecombo'
        });
    },

    _addDateSelectors: function (container) {
        container.removeAll();
        var label_width = 60;

        container.add({
            xtype: 'rallydatefield',
            itemId: 'start_date_selector',
            fieldLabel: 'Start Date:',
            labelWidth: label_width,
            stateful: true,
            stateEvents: ['change'],
            stateId: 'techservices-timeinstate-startdatecombo'
        });

        container.add({
            xtype: 'rallydatefield',
            itemId: 'end_date_selector',
            fieldLabel: 'End Date:',
            labelWidth: label_width,
            stateful: true,
            stateEvents: ['change'],
            stateId: 'techservices-timeinstate-enddatecombo'
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
        this.down('#export_button').setDisabled(true);
        var container = this.down('#display_box');
        container.removeAll();
    },

    _updateData: async function () {
        this._clearGrid();
        var field_name = this.state_field_name;

        this.startState = this.down('#start_state_selector').getValue();
        this.endState = this.down('#end_state_selector').getValue();
        if (field_name == "State" && /Portfolio/.test(this.model_name)) {
            this.startState = this.down('#start_state_selector').getRecord().get('name');
            this.endState = this.down('#end_state_selector').getRecord().get('name');
        }
        this.startDate = this.down('#start_date_selector').getValue();
        this.endDate = this.down('#end_date_selector').getValue();

        if (!this.startDate) {
            Ext.Msg.alert('', 'Start date is required');
            return;
        }

        if (Ext.isEmpty(this.startState) || Ext.isEmpty(this.endState)) {
            return;
        }

        Deft.Chain.pipeline([
            function () { return this._setValidStates(this._getModelName(), field_name) },
            function (states) { return this._getChangeSnapshots(field_name, this.model); },
            // this._addProjectsToSnapshots,
            this._organizeSnapshotsByOid,
            function (snaps_by_oid) { return this._setTimeInStatesForAll(snaps_by_oid, field_name); }
        ], this).then({
            scope: this,
            success: async function (rows_by_oid) {
                var rows = Ext.Object.getValues(rows_by_oid);
                rows = this._removeItemsOutsideTimeboxes(rows);
                rows = await this._syncWithCurrentData(rows);

                if (rows) {
                    this._makeGrid(rows);
                }
            },
            failure: function (msg) {
                this.setLoading(false);
                Ext.Msg.alert('Problem loading data', msg);
            }

        });
    },

    _syncWithCurrentData: async function (rows) {
        if (!rows.length) {
            return rows;
        }

        let fetch = ['ObjectID', 'FormattedID', 'Name', 'Project', 'Value'];
        let columns = this._getPickedColumns();
        for (let c of columns) {
            fetch.push(c.dataIndex);
        }

        let records = await this._getCurrentDataWithFilters(rows, fetch);

        if (!records) {
            Rally.ui.notify.Notifier.showError({ message: 'Failed while loading records. Result set might be too large.' });
            return null;
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

        if (this.searchAllProjects()) {
            context.project = null;
        }

        let ids = _.map(rows, r => r.ObjectID);
        let filters = await this.ancestorFilterPlugin.getAllFiltersForType(this._getModelName(), true).catch((e) => {
            Rally.ui.notify.Notifier.showError({ message: (e.message || e) });
        });

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

        var filtered_rows = this._getRowsAfter(rows, this.startDate);
        filtered_rows = this._getRowsBefore(filtered_rows, this.endDate);
        return filtered_rows;
    },

    _getRowsAfter: function (rows, start_date) {
        var enter_field = 'firstEntry_' + this.startState;

        if (Ext.isEmpty(start_date)) {
            return rows;
        }

        return Ext.Array.filter(rows, function (row) {
            var enter = row[enter_field];
            if (Ext.isEmpty(enter)) {
                return false;
            }
            return (Rally.util.DateTime.toIsoString(start_date) <= enter);
        });
    },

    _getRowsBefore: function (rows, end_date) {
        var enter_field = 'firstEntry_' + this.startState;
        if (Ext.isEmpty(end_date)) {
            return rows;
        }

        return Ext.Array.filter(rows, function (row) {
            var enter = row[enter_field];
            if (Ext.isEmpty(enter)) {
                return false;
            }
            return (Rally.util.DateTime.toIsoString(end_date) >= enter);
        });
    },

    _setTimeInStatesForAll: function (snaps_by_oid, field_name) {
        var rows_by_oid = {},
            me = this;
        Ext.Object.each(snaps_by_oid, function (key, snaps) {
            rows_by_oid[key] = me._calculateTimeInState(snaps, field_name);
        });
        return rows_by_oid;
    },

    _calculateTimeInState: function (snapshots, field_name) {
        var me = this;
        var entries = {};  // date of entry into state, used for calc
        var last_index = snapshots.length - 1;

        var row = Ext.Object.merge({
            snapshots: snapshots,
            //            FormattedID: snapshots[last_index].get('FormattedID'),
            //            Name: snapshots[last_index].get('Name'),
            //            Project: snapshots[last_index].get('Project'),
            __ProjectName: snapshots[last_index].get('__ProjectName'),
            __Project: snapshots[last_index].get('__Project')
        },
            snapshots[last_index].getData()
        );

        Ext.Array.each(this.allowedStates, function (state) {
            row[state] = 0;
            entries[state] = null;
            row['firstEntry_' + state] = null;
            row['lastExit_' + state] = null;
        });

        Ext.Array.each(snapshots, function (snap) {
            var in_state = snap.get(field_name);
            var snap_time = snap.get('_ValidFrom');

            entries[in_state] = snap_time;
            row['lastExit_' + in_state] = null; // clear out for re-entry

            if (Ext.isEmpty(row['firstEntry_' + in_state])) {
                row['firstEntry_' + in_state] = snap_time;
            }

            var out_state = snap.get('_PreviousValues.' + field_name);

            if (!Ext.isEmpty(entries[out_state])) {
                var jsStart = Rally.util.DateTime.fromIsoString(entries[out_state]);
                var jsEnd = Rally.util.DateTime.fromIsoString(snap_time);

                var delta = Rally.util.DateTime.getDifference(jsEnd, jsStart, 'minute');

                row[out_state] = row[out_state] + delta;
                row['lastExit_' + out_state] = snap_time;
            }
        });

        return row;
    },

    _getModelName: function () {
        return this.model_name;
    },

    _setValidStates: function (model_name, field_name) {
        this.logger.log('_setValidStates', model_name);

        var store = this.down('rallyfieldvaluecombobox').getStore();
        var count = store.getTotalCount();

        var values = [];
        for (var i = 0; i < count; i++) {
            var value = store.getAt(i);

            if (!Ext.isEmpty(value.get('value'))) {
                values.push(value.get('name'));
            }
        }
        this.logger.log('allowedStates', values);
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

    _getChangeSnapshots: function (field_name, model) {
        var filters = Ext.create('Rally.data.lookback.QueryFilter', {
            property: '_TypeHierarchy',
            value: this._getModelName()
        });

        var projects = this.down('#project_selector').getValue();

        if (this.searchAllProjects()) {

        } else if (projects.length > 0) {
            var project_filter = Ext.create('Rally.data.lookback.QueryFilter', {
                property: 'Project',
                operator: 'in',
                value: Ext.Array.map(projects, function (p) { return p.ObjectID; })
            });

            filters = filters.and(project_filter);
        } else {
            var project_filter = Ext.create('Rally.data.lookback.QueryFilter', {
                property: 'Project',
                operator: 'in',
                value: this.projects
            });

            filters = filters.and(project_filter);
        }

        let endFilter = Ext.create('Rally.data.lookback.QueryFilter', {
            property: '_ValidTo',
            operator: '>=',
            value: Rally.util.DateTime.toIsoString(this.startDate)
        });

        let change_filters = Ext.create('Rally.data.lookback.QueryFilter', {
            property: '_PreviousValues.' + field_name,
            operator: 'exists',
            value: true
        });

        endFilter = endFilter.and(change_filters);

        // var current_filter = Ext.create('Rally.data.lookback.QueryFilter', {
        //     property: '__At',
        //     value: 'current'
        // });

        // let dateRangeFilter = endFilter.or(current_filter);

        filters = filters.and(endFilter);

        console.log('filters:', filters.toObject());

        var fetch_base = ['ObjectID', 'FormattedID', 'Name',
            'Project', '_TypeHierarchy', '_PreviousValues',
            field_name, '_PreviousValues.' + field_name];

        var hydrate = ['_PreviousValues.' + field_name, field_name];

        var config = {
            filters,
            fetch: fetch_base,
            hydrate,
            limit: Infinity,
            enablePostGet: true,
            compress: true
        };

        return this._loadSnapshots(config);
    },

    _loadSnapshots: function (config) {
        console.log('loading snapshots');
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            removeUnauthorizedSnapshots: true
        };

        this.setLoading('Loading history...');
        this.logger.log("Starting load:", config);

        Ext.create('Rally.data.lookback.SnapshotStore', Ext.Object.merge(default_config, config)).load({
            callback: function (records, operation, successful) {
                me.setLoading(false);
                if (successful) {
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
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

    _loadWsapiRecords: function (config) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:", config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config, config)).load({
            callback: function (records, operation, successful) {
                if (successful) {
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
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
            showRowActionsColumn: false
        });
    },

    _getShowStates: function (allowed_states, start_state, end_state) {
        this.logger.log('_getShowStates', start_state, end_state);

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

    _getPickedColumns: function () {
        if (Ext.isEmpty(this.down('tscolumnpickerbutton'))) {
            return [];
        }

        return this.down('tscolumnpickerbutton').getChosenColumns();
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

        var metric = me.down('#metric_selector').getValue();

        var columns = [
            { dataIndex: 'FormattedID', text: 'id', width: 75 },
            { dataIndex: 'Name', text: 'Name', width: 200 },
            { dataIndex: '__ProjectName', text: 'Project', width: 155 }
        ];

        columns = Ext.Array.push(columns, this._getPickedColumns());

        var show_states = this._getShowStates(this.allowedStates, this.startState, this.endState);

        this.logger.log('show states', show_states);

        var date_renderer = function (value, meta, record) {
            if (Ext.isEmpty(value)) { return ""; }

            if (Ext.isString(value)) {
                value = Rally.util.DateTime.fromIsoString(value);
            }

            var format = me.timeFormat;
            if (metric == "Days") {
                format = me.dateFormat;
            }
            return Rally.util.DateTime.format(value, format);
        };


        Ext.Array.each(show_states, function (state) {
            columns.push({
                dataIndex: state,
                text: Ext.String.format('{0} ({1})', state, metric),
                align: 'right',
                renderer: function (value, meta, record) {
                    if (Ext.isEmpty(value)) { return ""; }

                    if (metric == "Days") {
                        return Ext.Number.toFixed(value / 1440, 2); // it's in minutes
                    }

                    return Ext.Number.toFixed(value / 60, 1);
                }
            });

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
        });

        this.logger.log('columns:', columns);
        return columns;
    },

    searchAllProjects() {
        return this.ancestorFilterPlugin && this.ancestorFilterPlugin.getIgnoreProjectScope();
    },

    _export: function () {
        var me = this;
        this.logger.log('_export');

        var grid = this.down('rallygrid');
        var rows = this.rows;

        this.logger.log('number of rows:', rows.length);

        if (!grid && !rows) { return; }

        var filename = 'time-in-state-report.csv';

        this.logger.log('saving file:', filename);

        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function () { return Rally.technicalservices.FileUtilities.getCSVFromRows(this, grid, rows); }
        ]).then({
            scope: this,
            success: function (csv) {
                this.logger.log('got back csv ', csv.length);
                if (csv && csv.length > 0) {
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv, filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({ message: 'No data to export' });
                }

            }
        }).always(function () { me.setLoading(false); });
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
        this.logger.log('onSettingsUpdate', settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
