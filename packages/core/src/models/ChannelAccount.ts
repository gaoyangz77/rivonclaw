import { types, type Instance } from "mobx-state-tree";

export const ChannelAccountStatusModel = types.model("ChannelAccountStatus", {
  hasContextToken: types.maybeNull(types.boolean),
});

export const ChannelAccountModel = types.model("ChannelAccount", {
  channelId: types.string,
  accountId: types.string,
  name: types.maybeNull(types.string),
  config: types.frozen<Record<string, unknown>>(),
  status: types.optional(ChannelAccountStatusModel, {}),
});

export interface ChannelAccount extends Instance<typeof ChannelAccountModel> {}
