Ext.define("TSTimeInState", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    
    layout: 'border',
    
    items: [
        {xtype:'container',itemId:'selector_box', region:'north', layout: 'hbox', defaults: { margin: 10 }},
        {xtype:'container',itemId:'display_box', region: 'center', layout: 'fit'}
    ],

    integrationHeaders : {
        name : "TSTimeInState"
    },
                        
    launch: function() {
        this._addSelectors();
    },
    
    _addSelectors: function() {
        var container = this.down('#selector_box');
        container.removeAll();
        
        var field_chooser_box = container.add({
            xtype:'container'
        });
        
        var state_chooser_box = container.add({
            xtype:'container',
            layout: 'vbox'
        });
         
        var date_chooser_box = container.add({
            xtype:'container',
            layout: 'vbox'
        });
        
        field_chooser_box.add({
            xtype:'rallyfieldcombobox',
            model:'HierarchicalRequirement',
            _isNotHidden: this._isNotHidden,
            stateful: true,
            stateId: 'techservices-timeinstate-fieldcombo',
            stateEvents:['change'],
            listeners: {
                scope: this,
                change: function(cb) {
                    console.log(cb.getValue());
                    this._addStateSelectors(state_chooser_box, cb.getValue());
                }
            }
        });
        
        //this._addDateSelectors(date_chooser_box);
        
        container.add({ xtype:'container', flex: 1});
        container.add({ 
            xtype:'rallybutton', 
            text: 'Update', 
            listeners: {
                scope: this,
                click: this._updateData
            }
        });
    },
    
    _addStateSelectors: function(container, field_name) {
        container.removeAll();
        this.state_field_name = field_name;
        var label_width = 60;
        
        container.add({
            xtype:'rallyfieldvaluecombobox',
            model: 'HierarchicalRequirement',
            itemId: 'start_state_selector',
            field: field_name,
            fieldLabel: 'Start State:',
            labelWidth: label_width
        });
        
        container.add({
            xtype:'rallyfieldvaluecombobox',
            model: 'HierarchicalRequirement',
            itemId: 'end_state_selector',
            field: field_name,
            fieldLabel: 'End State:',
            labelWidth: label_width
        });
    },
    
    _addDateSelectors: function(container) {
        container.removeAll();
        var label_width = 60;
        
        container.add({
            xtype:'rallydatefield',
            itemId: 'start_date_selector',
            fieldLabel: 'Start Date:',
            labelWidth: label_width
        });
        
        container.add({
            xtype:'rallydatefield',
            itemId: 'end_date_selector',
            fieldLabel: 'End Date:',
            labelWidth: label_width
        });
    },
    
      
    _isNotHidden: function(field) {
        if ( field.hidden ) {
            return false;
        }
        var attributeDefn = field.attributeDefinition;
        
        if ( Ext.isEmpty(attributeDefn) ) {
            return false;
        }
        
        if ( attributeDefn.AttributeType == "STATE" ) {
            return true;
        }
        
        if ( attributeDefn.AttributeType == "STRING" && attributeDefn.Constrained == true) {
            return true;
        }
        //this.logger.log(field);

        return false;
    },
    
    _updateData: function() {
        var model = 'HierarchicalRequirement';
        var field_name = this.state_field_name;
        
        this.startState = this.down('#start_state_selector').getValue();
        this.endState   = this.down('#end_state_selector').getValue();
        
        this.logger.log('start/end state', this.startState, this.endState);
        if ( Ext.isEmpty(this.startState) || Ext.isEmpty(this.endState) ) {
            return;
        }
        
        Deft.Chain.pipeline([
            function() { return this._setValidStates('HierarchicalRequirement', field_name) },
            function(states) { return this._getChangeSnapshots(field_name, "HierarchicalRequirement"); },
            this._organizeSnapshotsByOid,
            function(snaps_by_oid) { return this._setTimeInStatesForAll(snaps_by_oid, field_name); }
        ],this).then({
            scope: this,
            success: function(rows_by_oid) {
                var rows = Ext.Object.getValues(rows_by_oid);
                this.logger.log('rows:', rows);
                this._makeGrid(rows);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading data', msg);
            }
            
        });
    },
    
    _setTimeInStatesForAll: function(snaps_by_oid,field_name) {
        var rows_by_oid = {},
            me = this;
        Ext.Object.each(snaps_by_oid, function(key, snaps) {
            rows_by_oid[key] = me._calculateTimeInState(snaps,field_name);
        });
        return rows_by_oid;
    },
    
    _calculateTimeInState: function(snapshots, field_name) {
        var me = this;
        
        var entries = {};  // date of entry into state, used for calc
        var row = {
            snapshots: snapshots,
            FormattedID: snapshots[snapshots.length - 1].get('FormattedID'),
            Name: snapshots[snapshots.length - 1].get('Name'),
            Project: snapshots[snapshots.length - 1].get('Project')
        };
        
        this.logger.log(row.FormattedID, row.snapshots);
        
        Ext.Array.each(this.allowedStates, function(state){
            row[state] = 0;
            entries[state] = null;
        });
        
        
        Ext.Array.each(snapshots,function(snap){
            var in_state = snap.get(field_name);
            var snap_time = snap.get('_ValidFrom');
            me.logger.log("..Entering", in_state, snap_time);
            
            entries[in_state] = snap_time;
            
            var out_state = snap.get('_PreviousValues.' + field_name);
            me.logger.log("..Leaving", out_state, snap_time);
            if ( ! Ext.isEmpty(entries[out_state]) ) {
                var jsStart = Rally.util.DateTime.fromIsoString(entries[out_state]);
                var jsEnd   = Rally.util.DateTime.fromIsoString(snap_time);
                
                var delta = Rally.util.DateTime.getDifference(jsEnd, jsStart, 'minute');
                console.log("Change", delta, entries[out_state], snap_time);
                row[out_state] = row[out_state] + delta;
                entries[in_state] = null;
            }
        });
        
        row.unexited_states = [];
        Ext.Object.each(entries, function(key,value) {
            if ( !Ext.isEmpty(value) ) {
                row.unexited_states.push(key);
            }
        });
        
        return row;
    },
    _setValidStates: function(model_name, field_name) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        
        Rally.data.ModelFactory.getModel({
            type: model_name,
            success: function(model) {
                model.getField(field_name).getAllowedValueStore().load({
                    callback: function(records, operation, success) {
                        me.allowedStates = Ext.Array.map(records, function(allowedValue) {
                            //each record is an instance of the AllowedAttributeValue model 
                           return allowedValue.get('StringValue');
                        });
                        
                        deferred.resolve(me._allowedStates);
                    }
                });
            }
        });
        return deferred.promise;
    },
    
    _organizeSnapshotsByOid: function(snapshots) {
        var snapshots_by_oid = {};
        
        Ext.Array.each(snapshots, function(snap){
            var oid = snap.get('ObjectID');
            
            if ( Ext.isEmpty(snapshots_by_oid[oid]) ) {
                snapshots_by_oid[oid] = [];
            }
            
            snapshots_by_oid[oid].push(snap);
            
        });
        
        return snapshots_by_oid;
    },
    
    _getChangeSnapshots: function(field_name, model) {
        var change_into_states_filter = Ext.create('Rally.data.lookback.QueryFilter', {
            property: '_PreviousValues.' + field_name,
            operator: 'exists',
            value: true
        });
        
        var model_filter = Ext.create('Rally.data.lookback.QueryFilter', {
            property: '_TypeHierarchy',
            value: model
        });
        
        var project_filter = Ext.create('Rally.data.lookback.QueryFilter', {
            property: '_ProjectHierarchy',
            value: this.getContext().getProject().ObjectID
        });
        
        var filters = change_into_states_filter.and(model_filter).and(project_filter);
        
        var config = {
            filters: filters,
            fetch: ['ObjectID','FormattedID','Name','Project','_TypeHierarchy','_PreviousValues',field_name,'_PreviousValues.' + field_name],
            hydrate: ['ScheduleState','Project','_PreviousValues.'+field_name]
        };
        
        return this._loadSnapshots(config);
    },
    
    _loadSnapshots: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            removeUnauthorizedSnapshots: true
        };
        
        this.setLoading('Loading history...');
        this.logger.log("Starting load:",config);
        
        Ext.create('Rally.data.lookback.SnapshotStore', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    me.setLoading(false);
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _loadAStoreWithAPromise: function(model_name, model_fields){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(this);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _makeGrid: function(rows){
        this.rows = rows;
        var container = this.down('#display_box');
        container.removeAll();
        
        var store = Ext.create('Rally.data.custom.Store',{ data: rows });
        
        container.add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: this._getColumns()
        });
    },
    
    _getShowStates: function(allowed_states, start_state, end_state) {
        var start_index = Ext.Array.indexOf(allowed_states, start_state);
        var end_index   = Ext.Array.indexOf(allowed_states, end_state);
        
        // swap if chosen out of order
        if ( start_index > end_index ) {
            var holder = start_index;
            start_index = end_index;
            end_index = holder;
        }
        
        console.log(start_index, end_index, allowed_states, start_state, end_state);
        
        return ( 
            Ext.Array.filter(allowed_states, function(state,idx) {
                return ( idx >= start_index && idx <= end_index );
            })
        );
    },
    
    _getColumns: function() {
        var columns = [
            { dataIndex: 'FormattedID', text: 'id' },
            { dataIndex: 'Name', text: 'Name', flex: 1 }
        ];
        
        var show_states = this._getShowStates(this.allowedStates, this.startState, this.endState);
        
        
        Ext.Array.each(show_states, function(state) {
            columns.push({
                dataIndex: state,
                text: state,
                align: 'right',
                renderer: function(value, meta, record) {
                    return Ext.Number.toFixed( value / 1440, 2 ); // it's in minutes
                }
            });
        });
        return columns;
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});