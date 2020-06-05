Ext.define('Customagile.ui.ProjectPicker', {
    extend: 'Ext.Container',
    alias: 'widget.customagileprojectpicker',
    layout: 'vbox',

    cmp: null,
    appName: '',
    tab: null,

    initComponent() {
        this.callParent(arguments);

        this.add([
            {
                xtype: 'component',
                html: `If you require a report spanning across multiple project hierarchies, use this project picker to specify where the data will be pulled from. If blank, app will respect user's current project scoping.`,
                cls: 'x-form-item-label'
            },
            {
                xtype: 'customagilepillpicker',
                itemId: 'projectPicker',
                hidden: false,
                statefulKey: this.cmp.getContext().getScopedStateId(this.appName + '-project-picker'),
                defaultToRecentTimeboxes: false,
                listeners: {
                    recordremoved: this.projectsChanged,
                    scope: this
                },
                pickerCfg: {
                    xtype: 'customagilemultiselectproject',
                    width: 350,
                    margin: '10 0 0 0',
                    listeners: {
                        blur: this.projectsChanged,
                        change: this.projectsChanged,
                        scope: this
                    }
                }
            },
            {
                xtype: 'rallycheckboxfield',
                itemId: 'includeChildProjectsCheckbox',
                fieldLabel: 'Show work from child projects',
                labelSeparator: '',
                stateful: true,
                stateId: this.cmp.getContext().getScopedStateId(this.appName + '-scope-down-checkbox'),
                stateEvents: ['change'],
                labelWidth: 200,
                listeners: {
                    scope: this,
                    change: this.projectsChanged
                }
            }
        ]);

        this.projectPicker = this.down('#projectPicker');
        setTimeout(this.updateProjectTabText, 1000);
    },

    projectsChanged() {
        this.updateProjectTabText();
        this.fireEvent('projectschanged');
    },

    updateProjectTabText() {
        if (this.tab && this.projectPicker) {
            let totalProjects = this.projectPicker.getValue().length;
            let titleText = totalProjects ? `PROJECTS (${totalProjects})` : 'PROJECTS';
            this.tab.setTitle(titleText);
        }
    },

    getValue() {
        return this.projectPicker.getValue();
    },

    includeChildProjects() {
        return this.down('#includeChildProjectsCheckbox').getValue();
    }
});