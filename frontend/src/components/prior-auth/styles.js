// Styles for Prior Authorization Form components

// Custom CSS for DatePicker
export const datePickerStyles = `
  .react-datepicker__day--selected,
  .react-datepicker__day--keyboard-selected {
    background-color: #553781 !important;
    color: white !important;
  }
  .react-datepicker__day--selected:hover,
  .react-datepicker__day--keyboard-selected:hover {
    background-color: #452d6b !important;
    color: white !important;
  }
  .react-datepicker__day:hover {
    background-color: #f3f4f6 !important;
  }
  .react-datepicker__day--today {
    font-weight: bold;
    border: 1px solid #553781;
  }
  .react-datepicker-wrapper {
    width: 100%;
  }
  .datepicker-wrapper {
    position: relative;
    width: 100%;
  }
  .datepicker-wrapper .datepicker-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
    z-index: 1;
  }
  .datepicker-wrapper input {
    padding-left: 36px !important;
  }
`;

// Select styles matching the design system
export const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
    borderColor: '#e5e7eb',
    borderRadius: '6px',
    backgroundColor: state.isDisabled ? '#f3f4f6' : 'white',
    paddingLeft: '0.25rem',
    paddingRight: '0.25rem',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(85, 55, 129, 0.3)' : 'none',
    borderWidth: '1px',
    cursor: state.isDisabled ? 'not-allowed' : 'default',
    '&:hover': {
      borderColor: '#e5e7eb'
    }
  }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    backgroundColor: isSelected ? '#553781' : isFocused ? '#f3f4f6' : 'white',
    color: isSelected ? 'white' : '#374151',
    cursor: 'pointer',
    padding: '8px 12px'
  }),
  menu: (base) => ({ 
    ...base, 
    zIndex: 9999,
    position: 'absolute'
  }),
  menuPortal: (base) => ({ 
    ...base, 
    zIndex: 9999 
  })
};

