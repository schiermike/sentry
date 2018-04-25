import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import Reflux from 'reflux';
import styled from 'react-emotion';

import {addTeamToProject} from '../../../../actionCreators/projects';
import {t} from '../../../../locale';
import {buildUserId, buildTeamId} from '../../../../utils';
import {Client} from '../../../../api';
import MemberListStore from '../../../../stores/memberListStore';
import ProjectsStore from '../../../../stores/projectsStore';
import TeamStore from '../../../../stores/teamStore';
import MultiSelectField from '../../../../components/forms/multiSelectField';
import ActorAvatar from '../../../../components/actorAvatar';
import SentryTypes from '../../../../proptypes';
import Button from '../../../../components/buttons/button';
import InlineSvg from '../../../../components/inlineSvg';
import Tooltip from '../../../../components/tooltip';
import UserBadge from '../../../../components/userBadge';
import TeamBadge from '../../../../components/teamBadge';

class ValueComponent extends React.Component {
  static propTypes = {
    value: PropTypes.object,
    onRemove: PropTypes.func,
  };

  handleClick = () => {
    this.props.onRemove(this.props.value);
  };

  render() {
    return (
      <a onClick={this.handleClick}>
        <ActorAvatar actor={this.props.value.actor} size={28} />
      </a>
    );
  }
}

export default class SelectOwners extends React.Component {
  static propTypes = {
    project: SentryTypes.Project,
    organization: SentryTypes.Organization,
    value: PropTypes.array,
    onChange: PropTypes.func,
  };

  constructor(...args) {
    super(...args);
    this.api = new Client();

    // See comments in `handleAddTeamToProject` for why we close the menu this way
    this.projectsStoreMixin = Reflux.listenTo(ProjectsStore, () => {
      this.closeSelectMenu();
    });
  }

  state = {
    loading: false,
    inputValue: '',
  };

  componentDidMount() {
    if (this.projectsStoreMixin) {
      this.projectsStoreMixin.componentDidMount();
    }
  }

  componentWillUnmount() {
    this.api = null;

    if (this.projectsStoreMixin) {
      this.projectsStoreMixin.componentWillUnmount();
    }
  }

  createMentionableUser(member) {
    return {
      value: buildUserId(member.id),
      label: <UserBadge user={member} hideEmail useLink={false} />,
      searchKey: `${member.email}  ${member.name}`,
      actor: {
        type: 'user',
        id: member.id,
        name: member.name,
      },
    };
  }

  createMentionableTeam(team) {
    return {
      value: buildTeamId(team.id),
      label: <TeamBadge team={team} />,
      searchKey: `#${team.slug}`,
      actor: {
        type: 'team',
        id: team.id,
        name: team.slug,
      },
    };
  }

  getMentionableUsers() {
    return MemberListStore.getAll().map(this.createMentionableUser);
  }

  getMentionableTeams() {
    let {project} = this.props;
    let projectData = ProjectsStore.getBySlug(project.slug);

    if (!projectData) {
      return [];
    }

    return projectData.teams.map(this.createMentionableTeam);
  }

  /**
   * Get list of teams that are not in the current project, for use in `MultiSelectMenu`
   *
   * @param {Team[]} teamsInProject A list of teams that are in the current project
   */
  getTeamsNotInProject(teamsInProject = []) {
    let teams = TeamStore.getAll() || [];
    let excludedTeamIds = teamsInProject.map(({actor}) => actor.id);

    return teams.filter(team => excludedTeamIds.indexOf(team.id) === -1).map(team => ({
      value: buildTeamId(team.id),
      label: (
        <Flex justify="space-between">
          <DisabledLabel>
            <TeamBadge team={team} />
          </DisabledLabel>
          <Tooltip title={t(`Add #${team.slug} to project`)}>
            <Button
              size="zero"
              borderless
              onClick={this.handleAddTeamToProject.bind(this, team)}
            >
              <InlineSvg src="icon-circle-add" />
            </Button>
          </Tooltip>
        </Flex>
      ),
      disabled: true,
      searchKey: `#${team.slug}`,
      actor: {
        type: 'team',
        id: team.id,
        name: team.slug,
      },
    }));
  }

  /**
   * Closes the select menu by blurring input if possible since that seems to be the only
   * way to close it.
   */
  closeSelectMenu() {
    // Close select menu
    if (this.selectRef) {
      // eslint-disable-next-line react/no-find-dom-node
      let input = ReactDOM.findDOMNode(this.selectRef).querySelector(
        '.Select-input input'
      );
      if (input) {
        // I don't think there's another way to close `react-select`
        input.blur();
      }
    }
  }

  async handleAddTeamToProject(team) {
    let {organization, project, value} = this.props;
    // Copy old value
    let oldValue = [...value];

    // Optimistic update
    this.props.onChange([...this.props.value, this.createMentionableTeam(team)]);

    try {
      // Try to add team to project
      // Note: we can't close select menu here because we have to wait for ProjectsStore to update first
      // The reason for this is because we have little control over `react-select`'s `AsyncSelect`
      // We can't control when `handleLoadOptions` gets called, but it gets called when select closes, so
      // wait for store to update before closing the menu. Otherwise, we'll have stale items in the select menu
      await addTeamToProject(this.api, organization.slug, project.slug, team);
    } catch (err) {
      // Unable to add team to project, revert select menu value
      this.props.onChange(oldValue);
      this.closeSelectMenu();
    }
  }

  handleInputChange = newValue => {
    this.setState({inputValue: ''});
    this.props.onChange(newValue);
  };

  handleLoadOptions = () => {
    let {organization} = this.props;
    let usersInProject = this.getMentionableUsers();
    let teamsInProject = this.getMentionableTeams();
    let teamsNotInProject = this.getTeamsNotInProject(teamsInProject);
    let usersInProjectById = usersInProject.map(({actor}) => actor.id);

    // Return a promise for `react-select`
    return this.api
      .requestPromise(`/organizations/${organization.slug}/members/`, {
        query: this.state.inputValue,
      })
      .then(members => {
        // Be careful here as we actually want the `users` object
        return members
          ? members
              .filter(({user}) => user && usersInProjectById.indexOf(user.id) === -1)
              .map(({user}) => ({
                value: buildUserId(user.id),
                disabled: true,
                label: (
                  <DisabledLabel>
                    <UserBadge user={user} hideEmail useLink={false} />
                  </DisabledLabel>
                ),
                searchKey: `${user.email}  ${user.name}`,
                actor: {
                  type: 'user',
                  id: user.id,
                  name: user.name,
                },
              }))
          : [];
      })
      .then(members => {
        return {
          options: [
            ...usersInProject,
            ...teamsInProject,
            ...teamsNotInProject,
            ...members,
          ],
        };
      });
  };

  render() {
    return (
      <MultiSelectField
        filterOptions={(options, filterText) => {
          return options.filter(({searchKey}) => searchKey.indexOf(filterText) > -1);
        }}
        ref={ref => (this.selectRef = ref)}
        loadOptions={this.handleLoadOptions}
        defaultOptions
        async
        cache={false}
        style={{width: 200}}
        valueComponent={ValueComponent}
        placeholder={t('Add Owners')}
        onChange={this.handleInputChange}
        value={this.props.value}
      />
    );
  }
}

const DisabledLabel = styled('div')`
  opacity: 0.5;
`;
