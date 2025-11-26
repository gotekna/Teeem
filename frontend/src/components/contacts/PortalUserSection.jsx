import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PortalUserSection = ({ contact, contactPersons = [], onUpdate, isEditMode = false }) => {
  // Use parent's edit mode if provided, otherwise manage internally
  const [internalEditMode, setInternalEditMode] = useState(false);
  const isEditing = isEditMode || internalEditMode;
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [email, setEmail] = useState(contact.portal_user?.email || contact.email || '');
  const [password, setPassword] = useState('');
  const [hasSupplierAccess, setHasSupplierAccess] = useState(
    contact.portal_user?.portal_type === 'supplier' || contact.portal_user?.portal_type === 'both'
  );
  const [hasCustomerAccess, setHasCustomerAccess] = useState(
    contact.portal_user?.portal_type === 'customer' || contact.portal_user?.portal_type === 'both'
  );
  const [active, setActive] = useState(contact.portal_user?.active !== false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savedPassword, setSavedPassword] = useState('');

  const hasPortalUser = !!contact.portal_user;

  // When a contact person is selected, populate the email field
  const handlePersonSelect = (personId) => {
    setSelectedPersonId(personId);
    const person = contactPersons.find(p => p.id === parseInt(personId));
    if (person && person.email) {
      setEmail(person.email);
    }
  };

  const handleCreate = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    if (!hasSupplierAccess && !hasCustomerAccess) {
      setError('Please select at least one portal type');
      return;
    }

    setLoading(true);
    setError(null);

    // Determine portal_type based on checkboxes
    let portalType;
    if (hasSupplierAccess && hasCustomerAccess) {
      portalType = 'both';
    } else if (hasSupplierAccess) {
      portalType = 'supplier';
    } else {
      portalType = 'customer';
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/v1/contacts/${contact.id}/portal_user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email,
          password,
          portal_type: portalType
        })
      });

      const data = await response.json();

      if (data.success) {
        setSavedPassword(password);
        setPassword('');
        setInternalEditMode(false);
        alert('Portal user created successfully!');
        if (onUpdate) onUpdate();
      } else {
        setError(data.error || 'Failed to create portal user');
      }
    } catch (err) {
      setError('Failed to create portal user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!hasSupplierAccess && !hasCustomerAccess) {
      setError('Please select at least one portal type');
      return;
    }

    setLoading(true);
    setError(null);

    // Determine portal_type based on checkboxes
    let portalType;
    if (hasSupplierAccess && hasCustomerAccess) {
      portalType = 'both';
    } else if (hasSupplierAccess) {
      portalType = 'supplier';
    } else {
      portalType = 'customer';
    }

    try {
      const token = localStorage.getItem('token');
      const updateData = {
        email,
        portal_type: portalType,
        active
      };

      // Only include password if it was changed
      if (password) {
        updateData.password = password;
      }

      const response = await fetch(`${API_URL}/api/v1/contacts/${contact.id}/portal_user`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (data.success) {
        if (password) {
          setSavedPassword(password);
        }
        setPassword('');
        setInternalEditMode(false);
        alert('Portal user updated successfully!');
        if (onUpdate) onUpdate();
      } else {
        setError(data.error || 'Failed to update portal user');
      }
    } catch (err) {
      setError('Failed to update portal user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this portal user? They will no longer be able to access the portal.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/v1/contacts/${contact.id}/portal_user`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSavedPassword('');
        alert('Portal user deleted successfully!');
        if (onUpdate) onUpdate();
      } else {
        setError(data.error || 'Failed to delete portal user');
      }
    } catch (err) {
      setError('Failed to delete portal user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    // Generate password that meets validation requirements:
    // - At least one lowercase letter
    // - At least one uppercase letter
    // - At least one digit
    // - At least one special character
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const special = '!@#$%^&*';

    // Ensure at least one of each required type
    let newPassword = '';
    newPassword += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    newPassword += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    newPassword += digits.charAt(Math.floor(Math.random() * digits.length));
    newPassword += special.charAt(Math.floor(Math.random() * special.length));

    // Fill the rest with random characters from all types (12 more chars for 16 total)
    const allChars = lowercase + uppercase + digits + special;
    for (let i = 0; i < 12; i++) {
      newPassword += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    // Shuffle the password to avoid predictable pattern
    newPassword = newPassword.split('').sort(() => Math.random() - 0.5).join('');

    setPassword(newPassword);
  };

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">Portal Access</h3>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {!hasPortalUser || isEditing ? (
        <div className="relative">
          {/* Action Buttons - only show when NOT using parent edit mode */}
          {!isEditMode && (
            <div className="absolute top-0 right-0 flex gap-2">
              {!hasPortalUser ? (
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm"
                  >
                    {loading ? 'Updating...' : 'Update'}
                  </button>
                  <button
                    onClick={() => {
                      setInternalEditMode(false);
                      setEmail(contact.portal_user?.email || contact.email || '');
                      setPassword('');
                      setHasSupplierAccess(
                        contact.portal_user?.portal_type === 'supplier' || contact.portal_user?.portal_type === 'both'
                      );
                      setHasCustomerAccess(
                        contact.portal_user?.portal_type === 'customer' || contact.portal_user?.portal_type === 'both'
                      );
                      setActive(contact.portal_user?.active !== false);
                      setError(null);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 text-sm"
                  >
                    {loading ? 'Deleting...' : 'Delete'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Form content with right padding to prevent overlap with buttons (only when buttons are shown) */}
          <div className={`space-y-3 ${!isEditMode ? 'pr-80' : ''}`}>
            {/* Contact Person Selector */}
            {!hasPortalUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Contact Person (Optional)
                </label>
                {contactPersons.length > 0 ? (
                  <>
                    <select
                      value={selectedPersonId}
                      onChange={(e) => handlePersonSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select from contact persons or enter manually --</option>
                      {contactPersons.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.first_name} {person.last_name}
                          {person.email && ` (${person.email})`}
                          {person.is_primary && ' - Primary'}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Select a contact person to auto-fill their email, or enter the email manually below
                    </p>
                  </>
                ) : (
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-500">
                    No contact persons found. Add contact persons in the "Related Contacts" tab first, or enter email manually below.
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {!hasPortalUser && <span className="text-red-500">*</span>}
                {hasPortalUser && <span className="text-gray-500 text-xs ml-1">(leave blank to keep current)</span>}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={hasPortalUser ? "(unchanged)" : "Enter password"}
                />
                <button
                  type="button"
                  onClick={generatePassword}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                >
                  Generate
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Portal Access Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasSupplierAccess}
                    onChange={(e) => setHasSupplierAccess(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Supplier Portal</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasCustomerAccess}
                    onChange={(e) => setHasCustomerAccess(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Customer Portal</span>
                </label>
              </div>
            </div>

            {hasPortalUser && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-700">
                  Active
                </label>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2 bg-gray-50 p-3 rounded-md">
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-600">Email:</span>
            <span className="text-sm text-gray-900">{contact.portal_user.email}</span>
          </div>
          {savedPassword && (
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600">Password:</span>
              <span className="text-sm text-gray-900 font-mono">{savedPassword}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-600">Access:</span>
            <span className="text-sm text-gray-900">
              {contact.portal_user.portal_type === 'both'
                ? 'Supplier + Customer'
                : contact.portal_user.portal_type === 'supplier'
                ? 'Supplier Portal'
                : 'Customer Portal'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-600">Status:</span>
            <span className={`text-sm ${contact.portal_user.active ? 'text-green-600' : 'text-red-600'}`}>
              {contact.portal_user.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {contact.portal_user.last_login_at && (
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600">Last Login:</span>
              <span className="text-sm text-gray-900">
                {new Date(contact.portal_user.last_login_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Portal Preview Section */}
      {hasPortalUser && !isEditing && (
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Portal Preview</h3>
          <p className="text-sm text-gray-600 mb-4">
            This is what the {contact.portal_user.portal_type} will see when they log in to their portal.
          </p>

          {/* Portal Layout Preview */}
          <div className="bg-gray-50 border-2 border-gray-300 rounded-lg overflow-hidden">
            {/* Portal Header */}
            <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">T</span>
                </div>
                <span className="font-semibold">TEEEM Portal</span>
              </div>
              <div className="text-sm">
                {contact.portal_user.email}
              </div>
            </div>

            {/* Portal Navigation */}
            <div className="bg-gray-100 px-4 py-2 flex gap-4 text-sm border-b border-gray-300">
              <span className="text-blue-600 font-medium border-b-2 border-blue-600 pb-1">Dashboard</span>
              {contact.portal_user.portal_type === 'supplier' ? (
                <>
                  <span className="text-gray-600">Work Schedule</span>
                  <span className="text-gray-600">Purchase Orders</span>
                  <span className="text-gray-600">Payments</span>
                  <span className="text-gray-600">Maintenance</span>
                  <span className="text-gray-600">My Rating</span>
                </>
              ) : (
                <>
                  <span className="text-gray-600">Projects</span>
                  <span className="text-gray-600">Documents</span>
                  <span className="text-gray-600">Timeline</span>
                  <span className="text-gray-600">Payments</span>
                </>
              )}
            </div>

            {/* Portal Content */}
            <div className="p-4 space-y-4">
              {/* Dashboard Header */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  Welcome, {contact.display_name || contact.full_name || contact.email}
                </h2>
                <p className="text-sm text-gray-600">
                  {contact.portal_user.portal_type === 'supplier'
                    ? 'View your active projects, upcoming work, and payment status'
                    : 'Track your construction projects and view important documents'}
                </p>
              </div>

              {/* Dashboard Cards */}
              <div className="grid grid-cols-3 gap-3">
                {contact.portal_user.portal_type === 'supplier' ? (
                  <>
                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="text-2xl font-bold text-blue-600">
                        {contact.total_purchase_orders_count || 0}
                      </div>
                      <div className="text-xs text-gray-600">Purchase Orders</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="text-2xl font-bold text-green-600">
                        ${contact.total_purchase_orders_value ?
                          contact.total_purchase_orders_value.toLocaleString() : '0'}
                      </div>
                      <div className="text-xs text-gray-600">Total PO Value</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="text-2xl font-bold text-yellow-600">
                        {contact.teeem_rating ? contact.teeem_rating.toFixed(1) : 'N/A'}
                        {contact.teeem_rating && <span className="text-sm"> ★</span>}
                      </div>
                      <div className="text-xs text-gray-600">TEEEM Rating</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="text-2xl font-bold text-blue-600">0</div>
                      <div className="text-xs text-gray-600">Active Projects</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="text-2xl font-bold text-green-600">0%</div>
                      <div className="text-xs text-gray-600">Overall Progress</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="text-2xl font-bold text-purple-600">0</div>
                      <div className="text-xs text-gray-600">Documents</div>
                    </div>
                  </>
                )}
              </div>

              {/* Feature Sections Preview */}
              <div className="space-y-3">
                {contact.portal_user.portal_type === 'supplier' ? (
                  <>
                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm">Work Schedule (Gantt Chart)</h3>
                        <span className="text-xs text-gray-500">Interactive Timeline</span>
                      </div>
                      <div className="bg-gray-100 h-16 rounded flex items-center justify-center text-xs text-gray-500">
                        Gantt chart visualization of assigned tasks and dependencies
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm">Purchase Orders</h3>
                        <span className="text-xs text-blue-600">View All</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        View current and upcoming purchase orders for your work
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm">Payment Schedule</h3>
                        <span className="text-xs text-green-600">Track Payments</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Monitor payment milestones and invoice status
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm">TEEEM Rating</h3>
                        <span className="text-xs text-yellow-600">★★★★☆</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        View your performance ratings and feedback
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm">Project Timeline</h3>
                        <span className="text-xs text-gray-500">View Progress</span>
                      </div>
                      <div className="bg-gray-100 h-16 rounded flex items-center justify-center text-xs text-gray-500">
                        Interactive timeline showing project milestones
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm">Project Documents</h3>
                        <span className="text-xs text-blue-600">View All</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Access plans, specifications, and project documentation
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm">Payment Status</h3>
                        <span className="text-xs text-green-600">Up to Date</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        View payment schedule and transaction history
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-500 italic">
            Note: This is a preview. The actual portal will display live data based on assigned projects and tasks.
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalUserSection;
