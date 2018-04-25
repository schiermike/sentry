import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import AsyncSelect from 'react-select/lib/Async';
import styled from 'react-emotion';

import InputField from './inputField';

export default class MultiSelectField extends InputField {
  static propTypes = {
    async: PropTypes.bool,
    options: PropTypes.array,
    onChange: PropTypes.func,
    value: PropTypes.any,
  };

  constructor(props) {
    super(props);
    this.state = {
      values: [],
    };
  }

  handleChange = value => {
    this.setState({values: value}, () => {
      if (typeof this.props.onChange === 'function') {
        this.props.onChange(value);
      }
    });
  };

  renderArrow = () => {
    return <span className="icon-arrow-down" />;
  };

  render() {
    return (
      <MultiSelect
        style={{width: 200, zIndex: 100, overflow: 'visible'}}
        value={this.state.values}
        {...this.props}
        id={this.getId()}
        onChange={this.handleChange}
        multi={true}
        arrowRenderer={this.renderArrow}
      />
    );
  }
}

const MultiSelect = styled(({async, ...props}) => {
  if (async) {
    return <AsyncSelect {...props} />;
  }
  return <Select {...props} />;
})`
  font-size: 15px;
  .Select-control {
    overflow: visible;
  }
  .Select-input {
    height: 37px;
    input {
      padding: 10px 0;
    }
  }

  .Select-placeholder,
  .Select--single > .Select-control .Select-value {
    height: 37px;
    &:focus {
      border: 1px solid ${p => p.theme.gray};
    }
  }

  .Select-option.is-focused {
    color: white;
    background-color: ${p => p.theme.purple};
  }
  .Select-multi-value-wrapper {
    > a {
      margin-left: 4px;
    }
  }
`;
