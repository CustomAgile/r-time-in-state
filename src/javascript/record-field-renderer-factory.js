/**
     * Creates custom renderers based upon field types.
     */
Ext.define('CustomAgile.ui.renderer.RecordFieldRendererFactory', {
    singleton: true,

    getFieldDisplayValue: function (record, field, delimiter, cleanseForExport) {
        let val = record.get(field);
        let d = delimiter || ', ';

        if (_.isUndefined(val) || val === null) {
            val = "";
        }
        else if (typeof val === 'boolean') {
            val = val.toString();
        }
        else if (Ext.isDate(val)) {
            val = Rally.util.DateTime.formatWithDefaultDateTime(val);
        }
        else if (field === 'Parent') {
            val = (val && (val.FormattedID && val.Name && val.FormattedID + ': ' + val.Name) || val._refObjectName) || (record.get('Feature') && ((record.get('Feature').FormattedID && record.get('Feature').Name && record.get('Feature').FormattedID + ': ' + record.get('Feature').Name) || record.get('Feature')._refObjectName)) || 'No Parent';
        }
        else if (field === 'Release') {
            val = (val && val.Name) || 'Unscheduled';
        }
        else if (field === 'Parent') {
            val = (val && val.Name) ? `${val.FormattedID} - ${val.Name}` : '';
        }
        else if (field === 'Project') {
            val = (val && val.Name) || 'Failed to convert project field';
        }
        else if (field === 'Predecessors' || field === 'Successors') {
            val = typeof val === 'object' && typeof val.Count === 'number' ? val.Count : '';
        }
        else if (field === 'PredecessorsAndSuccessors') {
            val = typeof val.Predecessors === 'number' ? `Predecessors: ${val.Predecessors}; Successors: ${val.Successors}` : '';
        }
        else if (field === 'Owner' || field === 'CreatedBy') {
            val = val.DisplayName || (val.FirstName && val.LastName && `${val.FirstName} ${val.LastName}`) || val._refObjectName;
        }
        else if (field === 'PreliminaryEstimate') {
            val = `${val.Name} (${val.Value})`;
        }
        else if (field === 'Milestones') {
            if (val.Count) {
                val = _.map(val._tagsNameArray, (m) => {
                    return `${m.FormattedID} - ${m.Name}`;
                });
                val = val.join(d);
            }
            else {
                val = 'None';
            }
        }
        else if (field.toLowerCase().indexOf('portfolioitem/') > -1 || field === 'Feature') {
            val = val && `${val.FormattedID} - ${val.Name}` || 'None';
        }
        else if (typeof val === 'object') {
            if (val._tagsNameArray) {
                val = _.map(val._tagsNameArray, (m) => {
                    return m.Name || m.Value;
                });
                val = val.join(d);
            }
            else {
                val = val.Name || val.value || val._refObjectName || 'Unable to convert field for export';
            }
        }
        else if (_.isArray(val)) {
            val = val.join(d);
        }

        if (cleanseForExport) {
            val = this.cleanseExportValue(val);
        }

        return val;
    },

    cleanseExportValue(val) {
        let re = new RegExp(',' + '|\"|\r|\n', 'g');
        let reHTML = new RegExp('<\/?[^>]+>', 'g');
        let reNbsp = new RegExp('&nbsp;', 'ig');

        if (val && typeof val === "string") {
            val = val.replace(/,/g, '');
            val = val.replace(/"/g, "'");

            if (reHTML.test(val)) {
                val = val.replace('<br>', '\r\n');
                val = Ext.util.Format.htmlDecode(val);
                val = Ext.util.Format.stripTags(val);
            }
            if (reNbsp.test(val)) {
                val = val.replace(reNbsp, ' ');
            }
            // if (re.test(val)) {
            //     val = val.replace(/\"/g, '\"\"');
            //     val = Ext.String.format("\"{0}\"", val);
            // }
        }

        return val;
    }

});