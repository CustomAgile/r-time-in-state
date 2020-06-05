Ext.override(Rally.ui.combobox.FieldComboBox, {
    applyState: function (state) {
        if (this.store && !this.store.loading) {
            this.setValue(state.value);
            this.saveState();
        }
        else {
            this.callParent(arguments);
        }
    }
});

Ext.override(Rally.ui.DateField, {
    applyState: function (state) {
        if (state.value) {
            this.setValue(new Date(state.value));
        }
    }
});

Ext.override(Ext.form.field.Checkbox, {
    getState: function () {
        return { checked: this.getValue() };
    },
    applyState: function (state) {
        if (typeof state.checked === 'boolean') {
            this.setValue(state.checked);
        }
    }
});