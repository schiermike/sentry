import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {browserHistory} from 'react-router';
import qs from 'query-string';

import EnvironmentStore from '../stores/environmentStore';
import LatestContextStore from '../stores/latestContextStore';
import {ALL_ENVIRONMENTS_KEY} from '../constants';
import {setActiveEnvironment} from '../actionCreators/environments';

const withEnvironmentInQueryString = WrappedComponent =>
  createReactClass({
    displayName: 'withEnvironmentInQueryString',

    propTypes: {
      location: PropTypes.object,
    },

    mixins: [Reflux.listenTo(LatestContextStore, 'onLatestContextChange')],

    getInitialState() {
      const latestContext = LatestContextStore.getInitialState();
      return {
        environment: latestContext.environment,
        organization: latestContext.organization,
        hasEnvironmentsFeature: this.hasEnvironmentsFeature(latestContext.organization),
      };
    },

    componentWillMount() {
      const {hasEnvironmentsFeature, environment} = this.state;

      if (hasEnvironmentsFeature) {
        const {query, pathname} = this.props.location;

        const isDefaultEnvironment = environment === EnvironmentStore.getDefault();

        // Update the query string to match environment if they are not in sync
        if (environment) {
          if (environment.name !== query.environment) {
            if (isDefaultEnvironment) {
              delete query.environment;
            } else {
              query.environment = environment.name;
            }
            browserHistory.replace(`${pathname}?${qs.stringify(query)}`);
          }
        } else {
          if (environment === null && !isDefaultEnvironment) {
            query.environment = ALL_ENVIRONMENTS_KEY;
            browserHistory.replace(`${pathname}?${qs.stringify(query)}`);
          }
        }
      }
    },

    componentWillReceiveProps(nextProps) {
      // We update the environment to match the query string if they are out of sync and
      // new props are received. This is required so the back button triggers a return
      // to the previous environment
      const {organization, environment} = this.state;
      const environmentString = nextProps.location.query.environment;

      // TODO(lyn): Remove this block when environments feature is active
      const hasEnvironmentsFeature = this.hasEnvironmentsFeature(organization);
      if (!hasEnvironmentsFeature) return;
      // End remove block

      const nextEnvironment =
        environmentString === ALL_ENVIRONMENTS_KEY
          ? null
          : EnvironmentStore.getByName(environmentString) ||
            EnvironmentStore.getDefault();

      if (nextEnvironment !== environment) {
        setActiveEnvironment(nextEnvironment);
      }
    },

    onLatestContextChange({environment, organization}) {
      // TODO(lyn): Remove this when environments feature is active
      const hasEnvironmentsFeature = this.hasEnvironmentsFeature(organization);

      const environmentHasChanged = environment !== this.state.environment;

      const defaultEnvironment = EnvironmentStore.getDefault();

      if (hasEnvironmentsFeature && environmentHasChanged) {
        const {query, pathname} = this.props.location;
        if (environment === defaultEnvironment) {
          // We never show environment in the query string if it's the default one
          delete query.environment;
        } else {
          // We show ?environment=__all_environments__ in the query string if 'All environments'
          // is selected and that is not the default
          const envName = environment ? environment.name : ALL_ENVIRONMENTS_KEY;
          query.environment = envName;
        }
        browserHistory.push(`${pathname}?${qs.stringify(query)}`);
      }

      this.setState({
        environment,
        organization,
        hasEnvironmentsFeature,
      });
    },

    hasEnvironmentsFeature(org) {
      const features = new Set(org ? org.features : []);
      return features.has('environments');
    },

    render() {
      const environment = this.state.hasEnvironmentsFeature
        ? this.state.environment
        : null;

      return <WrappedComponent environment={environment} {...this.props} />;
    },
  });

export default withEnvironmentInQueryString;
