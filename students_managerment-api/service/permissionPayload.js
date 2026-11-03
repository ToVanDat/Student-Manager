const findIncompletePermissionKeys = (catalogRows, permissions) => {
    const submitted = new Set(permissions.map(item => item.permission_key));
    return catalogRows
        .map(row => row.permission_key)
        .filter(permissionKey => !submitted.has(permissionKey));
};

module.exports = { findIncompletePermissionKeys };
